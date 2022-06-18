import { BaseClient, type Channel, type RawMessage, type Credentials } from "./base.ts";
import { type Message } from "./message.ts";
import { AccountStatus, DefaultLimiter, RateLimiter } from "./ratelimit.ts";
import { SameMessageBypass } from "./smb.ts";
import { LatencyTest } from "./latency.ts";
import { JoinQueue, PrivmsgQueue } from "./queue.ts";
import { Privmsg, UserState, Join, Part } from "./message/index.ts";

// TODO: maintain userstate and roomstate so that rate limiters can work properly
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
 */
export class Client {
  private _client: BaseClient;
  private _sameMessageBypass = new SameMessageBypass();
  private _latencyTest: LatencyTest;
  private _limiter: RateLimiter;
  private _privmsgQueue: PrivmsgQueue;
  private _joinQueue: JoinQueue;
  private _channels = new Set<Channel>();
  private _listeners: { [K in keyof ChatEventData]: Set<(event: ChatEventData[K]) => void> } =
    // deno-lint-ignore no-explicit-any
    Object.fromEntries(Events.map((event) => [event, new Set()])) as any;

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
    this._limiter = options.rateLimiter ?? new DefaultLimiter({ status: options.accountStatus });
    this._privmsgQueue = new PrivmsgQueue(
      (msg) => this._client.send(msg),
      this._limiter,
      () => this._client.socketReadyState
    );
    this._joinQueue = new JoinQueue((msg) => this._client.send(msg), this._limiter);
    this._client.on("message", this._onmessage);
    this._client.on("open", this._onopen);
    this._client.on("close", this._onclose);
    this._client.on("error", this._onerror);
  }

  /** Current latency to the server. */
  get latency(): number {
    return this._latencyTest.value;
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
    // TODO: remaining events
    // I'm probably missing some
    // - host
    // - roomstate
    // - usernotice -> sub, raid (https://git.kotmisia.pl/Mm2PL/docs/src/branch/master/irc_msg_ids.md#usernotice-msg-ids)
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
  raw: Message;
};
const Events = ["open", "close", "error", "privmsg", "userstate", "join", "part", "raw"] as const;
type _check = typeof Events[number] extends keyof ChatEventData
  ? keyof ChatEventData extends typeof Events[number]
    ? "ok"
    : "Missing events in Events"
  : "Missing events in ChatEventData";
const _check: _check = "ok";
