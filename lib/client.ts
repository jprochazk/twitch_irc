import { BaseClient, type Channel, type RawMessage, type Credentials } from "./base.ts";
import { type Message } from "./message.ts";
import { AccountStatus, ChannelRole, DefaultLimiter, RateLimiter } from "./ratelimit.ts";
import { SameMessageBypass } from "./smb.ts";
import { LatencyTest } from "./latency.ts";
import { JoinQueue, PrivmsgQueue } from "./queue.ts";
import {
  Privmsg,
  UserState,
  Join,
  Part,
  ClearMsg,
  ClearChat,
  GlobalUserState,
  HostTarget,
  Reconnect,
  UserNotice,
  Notice,
  RoomState,
} from "./message/index.ts";
import { DeepReadonly } from "./util.ts";

// TODO: emit error events based on `NOTICE` commands

/**
 * High-level interface for building bots.
 *
 * Features:
 * - Simple interface to each chat event (not 1:1 with IRC commands)
 * - Outgoing message queue with proper rate limiting
 * - Automatically rejoining channels upon (re)connecting
 * - Measuring latency
 * - Same message bypass
 * - Rate limiting
 */
export class Client {
  private _client: BaseClient;
  private _sameMessageBypass = new SameMessageBypass();
  private _latencyTest: LatencyTest;
  private _rateLimiter: RateLimiter;
  private _privmsgQueue: PrivmsgQueue;
  private _joinQueue: JoinQueue;
  private _channels = new Set<Channel>();
  private _listeners: { [K in keyof ChatEventData]: Set<(event: ChatEventData[K]) => void> } =
    // deno-lint-ignore no-explicit-any
    Object.fromEntries(Events.map((event) => [event, new Set()])) as any;
  private _state: State;

  constructor(
    options: {
      /**
       * Credentials used to authenticate.
       *
       * If configured, the bot will also join its own channel by joining `#${credentials.login}`.
       */
      credentials?: Credentials;
      accountStatus?: AccountStatus;
      /**
       * Custom implementation of a rate limiter.
       *
       * The default one is based on the official Twitch IRC rate limiting documentation, but
       * if for some reason you need a custom one, you can pass it through here.
       */
      rateLimiter?: RateLimiter;
    } = {}
  ) {
    this._client = new BaseClient({
      capabilities: ["twitch.tv/commands", "twitch.tv/membership", "twitch.tv/tags"],
      ...options,
    });
    this._latencyTest = new LatencyTest(this._client);
    this._rateLimiter =
      options.rateLimiter ?? new DefaultLimiter({ status: options.accountStatus });
    this._privmsgQueue = new PrivmsgQueue(
      (msg) => this._client.send(msg),
      this._rateLimiter,
      () => this._client.socketReadyState
    );
    this._joinQueue = new JoinQueue((msg) => this._client.send(msg), this._rateLimiter);
    this._client.on("message", this._onmessage);
    this._client.on("open", this._onopen);
    this._client.on("close", this._onclose);
    this._client.on("error", this._onerror);
    this._state = {
      global: {
        id: "",
        emoteSets: [],
        badges: {},
        badgeInfo: {},
        login: this._client.nick,
      },
      channel: {},
    };

    this.on("part", (e) => {
      if (e.user === this._client.nick) {
        this._channels.delete(e.channel);
      }
    });

    this.on("globaluserstate", (e) => {
      const state = this._state.global;
      state.id = e.user.id;
      state.color = e.user.color;
      state.emoteSets = e.emoteSets;
      state.badges = e.user.badges;
      state.badgeInfo = e.user.badgeInfo;
      state.displayName = e.user.displayName;
      state.login = e.user.login;
    });
    this.on("userstate", (e) => {
      const current = this._state.channel[e.channel];
      this._state.channel[e.channel] = {
        role: e.role,
        badges: e.badges,
        badgeInfo: e.badgeInfo,
        emote: current?.emote ?? false,
        followers: current?.followers ?? 0,
        r9k: current?.r9k ?? false,
        slow: current?.slow ?? 1,
        sub: current?.sub ?? false,
      };
      const global = this._state.global;
      global.emoteSets = e.emoteSets;
      global.color = e.color;
    });
    this.on("roomstate", (e) => {
      const current = this._state.channel[e.channel];
      this._state.channel[e.channel] = {
        role: current?.role ?? ChannelRole.Viewer,
        badges: current?.badges ?? this._state.global.badges,
        badgeInfo: current?.badgeInfo ?? this._state.global.badgeInfo,
        emote: e.emote ?? current?.emote ?? false,
        followers: e.followers ?? current?.followers ?? 0,
        r9k: e.r9k ?? current?.r9k ?? false,
        slow: e.slow ?? current?.slow ?? 1,
        sub: e.sub ?? current?.sub ?? false,
      };
    });
  }

  /** Current latency to the server. */
  get latency(): number {
    return this._latencyTest.value;
  }

  /**
   * Current bot state.
   *
   * Includes global user state and per-channel user + room state.
   */
  get state(): ReadonlyState {
    return this._state;
  }

  /**
   * Sends a `PING` with an optional `arg`, which will be sent back by Twitch with the resulting `PONG`.
   */
  ping(arg?: string) {
    this._client.send(arg ? `PING :${arg}\r\n` : "PING\r\n");
  }

  /**
   * Sends a `PONG` with an optional `arg`.
   */
  pong(arg?: string) {
    this._client.send(arg ? `PONG :${arg}\r\n` : "PONG\r\n");
  }

  /**
   * Joins a `channel`.
   *
   * `channel` must begin with `#`.
   *
   * This returns a `Promise` that resolves once the channel has been joined successfully.
   *
   * Any joined channels will be automatically re-joined upon reconnecting.
   */
  join(channel: Channel): Promise<void> {
    return this._join(channel, true);
  }

  private _join(channel: Channel, filterJoined: boolean): Promise<void> {
    if (filterJoined && this._channels.has(channel)) return Promise.resolve();
    this._joinQueue.send(`JOIN ${channel}\r\n`);

    return new Promise((resolve, reject) => {
      const off = this.on("join", (e) => {
        if (e.channel === channel && e.user === this._client.nick) {
          off();
          this._channels.add(channel);
          resolve();
        }
      });
      this.on("close", () => {
        off();
        reject();
      });
    });
  }

  /**
   * Leaves `channel`.
   *
   * `channel` must begin with `#`.
   *
   * `PART` commands are sent without queueing.
   */
  part(channel: Channel) {
    this._client.send(`PART ${channel}\r\n`);
    this._channels.delete(channel);
  }

  /**
   * Returns `true` if this bot is in `channel`.
   *
   * `channel` must begin with `#`.
   */
  joined(channel: Channel) {
    return this._channels.has(channel);
  }

  /**
   * Send a privmsg containing `message` to `channel`.
   *
   * `channel` must begin with `#`.
   *
   * `PRIVMSG` commands are sent through a queue.
   * This methods returns a `Promise` which will resolve once the message is sent.
   *
   * You can optionall specify `tags`:
   * - `reply-parent-msg-id`, which will make the message a reply to the parent message.
   * - `client-nonce`, which will be present in the `USERSTATE` response, allowing userstates
   *   to be associated with the message that triggered it.
   *
   * This won't work if you have not configured `credentials` when creating the client.
   */
  privmsg(
    channel: Channel,
    message: string,
    tags: { replyParentMsgId?: string; clientNonce?: string } = {}
  ) {
    const tagPairs = [];
    if (tags.replyParentMsgId) tagPairs.push(`reply-parent-msg-id=${tags.replyParentMsgId}`);
    if (tags.clientNonce) tagPairs.push(`client-nonce=${tags.clientNonce}`);

    const body = `PRIVMSG ${channel} :${message}${this._sameMessageBypass.get()}\r\n` as const;
    let data: RawMessage;
    if (tagPairs.length === 0) {
      data = body;
    } else {
      data = `@${tagPairs.join(";")} ${body}`;
    }

    this._privmsgQueue.send(data, channel);
  }

  /**
   * Connects an event callback.
   *
   * Returns a function that can be called to unsubscribe. Alternatively,
   * you can also call `.off` with the same reference to the same callback.
   */
  on<Type extends keyof ChatEventData>(
    type: Type,
    callback: (event: ChatEventData[Type]) => void,
    options: { once?: boolean } = {}
  ): () => void {
    if (options.once) {
      const wrapper = (event: ChatEventData[Type]) => {
        callback(event);
        this._listeners[type].delete(wrapper);
      };
      callback = wrapper;
    }

    this._listeners[type].add(callback);
    return () => this._listeners[type].delete(callback);
  }

  /**
   * Disconnects an event callback.
   */
  off<Type extends keyof ChatEventData>(
    type: Type,
    callback: (event: ChatEventData[Type]) => void
  ) {
    this._listeners[type].delete(callback);
  }

  private _emit<Type extends keyof WithoutData>(type: Type): void;
  private _emit<Type extends keyof WithData>(type: Type, data: WithData[Type]): void;
  // deno-lint-ignore no-explicit-any
  private _emit(type: string, data?: any): void {
    // deno-lint-ignore no-explicit-any
    for (const callback of (this._listeners as any)[type]) {
      callback(data);
    }
  }

  private _onmessage = (data: Message) => {
    this._emit("raw", data);

    switch (data.command.kind) {
      case "PRIVMSG": {
        this._emit("privmsg", Privmsg.parse(data));
        return;
      }
      case "USERSTATE": {
        this._emit("userstate", UserState.parse(data));
        return;
      }
      case "JOIN": {
        this._emit("join", Join.parse(data));
        return;
      }
      case "PART": {
        this._emit("part", Part.parse(data));
        return;
      }
      case "CLEARCHAT": {
        this._emit("clearchat", ClearChat.parse(data));
        return;
      }
      case "CLEARMSG": {
        this._emit("clearmsg", ClearMsg.parse(data));
        return;
      }
      case "GLOBALUSERSTATE": {
        this._emit("globaluserstate", GlobalUserState.parse(data, this._client.nick));
        return;
      }
      case "HOSTTARGET": {
        this._emit("hosttarget", HostTarget.parse(data));
        return;
      }
      case "RECONNECT": {
        this._emit("reconnect", Reconnect.parse(data));
        return;
      }
      case "USERNOTICE": {
        this._emit("usernotice", UserNotice.parse(data));
        return;
      }
      case "NOTICE": {
        this._emit("notice", Notice.parse(data, this._client.nick));
        return;
      }
      case "ROOMSTATE": {
        this._emit("roomstate", RoomState.parse(data));
        return;
      }
    }
  };

  private _onopen = () => {
    this._channels.forEach((channel) => this._join(channel, false));
    this._latencyTest.start();
    this._joinQueue.pause(false);
    this._emit("open");
  };

  private _onclose = () => {
    this._emit("close");
    this._joinQueue.pause(true);
    this._joinQueue.clear();
    this._latencyTest.stop();
  };

  private _onerror = (e: unknown) => this._emit("error", e);
}

type WithData = {
  [K in keyof ChatEventData as ChatEventData[K] extends void ? never : K]: ChatEventData[K];
};
type WithoutData = {
  [K in keyof ChatEventData as ChatEventData[K] extends void ? K : never]: ChatEventData[K];
};

type ChatEventData = {
  open: void;
  close: void;
  error: unknown;
  privmsg: Privmsg;
  userstate: UserState;
  join: Join;
  part: Part;
  clearchat: ClearChat;
  clearmsg: ClearMsg;
  globaluserstate: GlobalUserState;
  hosttarget: HostTarget;
  reconnect: Reconnect;
  usernotice: UserNotice;
  notice: Notice;
  roomstate: RoomState;
  raw: Message;
};
const Events = [
  "open",
  "close",
  "error",
  "privmsg",
  "userstate",
  "join",
  "part",
  "clearchat",
  "clearmsg",
  "globaluserstate",
  "hosttarget",
  "reconnect",
  "usernotice",
  "notice",
  "roomstate",
  "raw",
] as const;
type _check = typeof Events[number] extends keyof ChatEventData
  ? keyof ChatEventData extends typeof Events[number]
    ? "ok"
    : "Missing events in Events"
  : "Missing events in ChatEventData";
const _check: _check = "ok";

type ReadonlyState = DeepReadonly<State>;

type State = {
  /** Global user state */
  global: {
    id: string;
    color?: string;
    emoteSets: string[];
    badges: Record<string, string>;
    badgeInfo: Record<string, string>;
    displayName?: string;
    login: string;
  };
  /** Per-channel user+room state */
  channel: Record<
    Channel,
    {
      role: ChannelRole;
      badges: Record<string, string>;
      badgeInfo: Record<string, string>;
      /**
       * Emote-only mode (messages may contain only Twitch emotes).
       *
       * Values:
       * - `null` -> unchanged from previous roomstate
       * - `true` -> enabled
       * - `false` -> disabled
       */
      emote: boolean;
      /**
       * Followers-only mode - only followers may chat.
       * Additionally, a minimum followage (in minutes) may be specified.
       *
       * Values:
       * - `null` -> unchanged from previous roomstate
       * - `-1` -> disabled
       * - `0` -> enabled (no minimum followage)
       * - `> 0` -> enabled (`value` = minimum followage)
       */
      followers: number;
      /**
       * R9K mode - messages with more than 9 characters must be globally unique
       *
       * Values:
       * - `null` -> unchanged from previous roomstate
       * - `true` -> enabled
       * - `false` -> disabled
       */
      r9k: boolean;
      /**
       * Slow mode - each user may only send a message every `value` seconds
       *
       * Values:
       * - `null` -> unchanged from previous roomstate
       * - `0` -> disabled
       * - `> 0` -> enabled (value determines the duration)
       */
      slow: number;

      /**
       * Sub-only mode - only subscribers may chat.
       *
       * Values:
       * - `null` -> unchanged from previous roomstate
       * - `true` -> enabled
       * - `false` -> disabled
       */
      sub: boolean;
    }
  >;
};
