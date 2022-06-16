import { BaseClient, type Channel, type RawMessage, type Credentials } from "./base.ts";
import { type Message } from "./message.ts";
import { ChannelRole, AccountStatus, DefaultLimiter, RateLimiter } from "./ratelimit.ts";
import { SameMessageBypass } from "./smb.ts";
import { LatencyTest } from "./latency.ts";
import { PrivmsgQueue } from "./queue.ts";

// TODO: remaining events
// I'm probably missing some
// - host
// - join
// - part
// - roomstate
// - usernotice -> sub, raid (https://git.kotmisia.pl/Mm2PL/docs/src/branch/master/irc_msg_ids.md#usernotice-msg-ids)
// TODO: maintain userstate and roomstate so that rate limiters can work properly
// TODO: consider adding "raw" event which just relays the basic message
// TODO: emit error events based on `NOTICE` commands
// TODO: option for message queue to discard messages instead of growing

/**
 * High-level interface for building bots.
 *
 * Features:
 * - Simple interface to each chat event (not 1:1 with IRC commands)
 * - Rate limiting
 * - Same message bypass
 * - Automatically rejoining channels upon (re)connecting
 * - Measuring latency
 */
export class Client {
  private _client: BaseClient;
  private _sameMessageBypass = new SameMessageBypass();
  private _latencyTest: LatencyTest;
  private _limiter: RateLimiter;
  private _privmsgQueue: PrivmsgQueue;
  private _channels = new Set<Channel>();
  private _listeners: { [K in keyof ChatEventData]: Set<(event: ChatEventData[K]) => void> } = {
    userstate: new Set(),
    privmsg: new Set(),
    open: new Set(),
    close: new Set(),
    error: new Set(),
  };

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
    this._privmsgQueue = new PrivmsgQueue((msg) => this._client.send(msg), this._limiter);
    this._client.on("message", this._onmessage);
    this._client.on("open", () => {
      this._latencyTest.start();
      this._channels.forEach((channel) => {
        this.join(channel);
        this._privmsgQueue.open(channel);
      });
      this._emit("open");
    });
    this._client.on("close", () => {
      this._latencyTest.stop();
      this._channels.forEach((channel) => {
        this._privmsgQueue.close(channel);
      });
      this._emit("close");
    });
    this._client.on("error", (e) => this._emit("error", e));
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
   * Joins `channel`.
   *
   * `channel` must begin with `#`.
   *
   * Any joined channels will be automatically re-joined upon reconnecting.
   */
  join(channel: Channel) {
    // TODO(?): should this return a promise that resolves when the channel is successfully joined,
    //          and rejects otherwise? Or should `joined` just be an event?
    // TODO: handle failing to join a channel - it must be removed from `this._channels`
    // TODO: join queue
    // TODO: join batching (comma separated channels)
    if (!this._channels.has(channel)) {
      this._channels.add(channel);
      this._client.send(`JOIN ${channel}\r\n`);
      this._privmsgQueue.open(channel);
    }
  }

  /**
   * Leaves `channel`.
   *
   * `channel` must begin with `#`.
   *
   * `PART` commands are sent without queueing.
   */
  part(channel: Channel) {
    if (this._channels.has(channel)) {
      this._channels.delete(channel);
      this._client.send(`PART ${channel}\r\n`);
      this._privmsgQueue.close(channel);
    }
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
   */
  on<Type extends keyof ChatEventData>(type: Type, callback: (event: ChatEventData[Type]) => void) {
    this._listeners[type].add(callback);
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
    // TODO: switch on data.command.kind, parse, dispatch
    switch (data.command.kind) {
      case "PRIVMSG": {
        this._emit("privmsg", parsePrivmsgEvent(data));
        return;
      }
      case "USERSTATE": {
        this._emit("userstate", parseUserStateEvent(data));
        return;
      }
    }
  };
}

function parsePrivmsgEvent(data: Message): PrivmsgEvent {
  return {
    raw: data,
    type: "privmsg",
    channel: data.channel!,
    id: data.tags!.id!,
    roomId: data.tags!.roomId!,
    user: parseUser(data),
    message: data.params.at(-1)!,
    sentAt: data.tag("tmiSentTs", "number")!,
    emotes: data.tag("emotes", "csv")?.map(parseEmote) ?? [],
  };
}

function parseUserStateEvent(data: Message): UserStateEvent {
  const badges = parseBadges(data.tag("badges", "csv") ?? []);
  return {
    raw: data,
    type: "userstate",
    role: parseRole(badges),
    emoteSets: data.tag("emoteSets", "csv") ?? [],
    color: data.tags!.color,
    badges,
    badgeInfo: parseBadges(data.tag("badgeInfo", "csv") ?? []),
  };
}

/** Assumes `data` contains all required information for `User` */
function parseUser(data: Message): User {
  const id = data.tags!.userId!;
  const badges = parseBadges(data.tag("badges", "csv") ?? []);
  const role = parseRole(badges);
  const login = data.prefix!.nick!;
  const badgeInfo = parseBadges(data.tag("badgeInfo", "csv") ?? []);
  const displayName = data.tag("displayName") ?? undefined;
  const color = data.tags!.color;

  const user: User = {
    id,
    role,
    login,
    badges,
    badgeInfo,
  };
  if (displayName) user.displayName = displayName;
  if (color) user.color = color;
  return user;
}

function parseRole(badges: Record<string, string>): ChannelRole {
  if ("broadcaster" in badges) return ChannelRole.Streamer;
  if ("moderator" in badges) return ChannelRole.Moderator;
  if ("vip" in badges) return ChannelRole.VIP;
  if ("subscriber" in badges) return ChannelRole.Subscriber;
  return ChannelRole.Viewer;
}

function parseBadges(badges: string[]) {
  const result: Record<string, string> = {};
  for (let i = 0; i < badges.length; ++i) {
    const [name, info] = badges[i].split("/");
    result[name] = info;
  }
  return result;
}

function parseEmote(emote: string): Emote {
  const [id, range] = emote.split(":");
  const [start, end] = range.split("-");
  return {
    id,
    range: { start: parseInt(start), end: parseInt(end) },
  };
}

export type PrivmsgEvent = {
  raw: Message;
  type: "privmsg";
  /**
   * Name of the channel this message was sent from.
   */
  channel: Channel;
  /**
   * Id of this message.
   *
   * Can be used to delete messages.
   */
  id: string;
  /**
   * Id of the channel this message was sent from.
   *
   * This is also the streamer's user-id.
   */
  roomId: string;
  /**
   * User who sent this message.
   */
  user: User;
  /**
   * Message content.
   */
  message: string;
  /**
   * Timestamp (in milliseconds) of when this message was sent
   */
  sentAt: number;
  /**
   * Emotes which were were used in this message.
   *
   * An `Emote` consists of an emote `id` and a `range`, where the `range`
   * contains a start and end index, which can be used to index into the
   * message content.
   */
  emotes: Emote[];
};

export type UserStateEvent = {
  raw: Message;
  type: "userstate";
  role: ChannelRole;
  /**
   * A comma-delimited list of IDs that identify the emote sets that the user has access to.
   */
  emoteSets: string[];
  /**
   * Hex string representing the RGB color of the user's name.
   */
  color?: string;
  /**
   * Map of badges.
   *
   * Example: `badges=subscriber/0,broadcaster/1` will result in:
   * ```json
   * {
   *   "subscriber": 0,
   *   "broadcaster": 1
   * }
   * ```
   */
  badges: Record<string, string>;
  /**
   * Map of badge infos.
   *
   * This has the same format as `badges`, but contains more specific information,
   * e.g. for `subscriber`, contains the exact number of subscribed months in `version`.
   */
  badgeInfo: Record<string, string>;
};

export type User = {
  id: string;
  role: ChannelRole;
  /**
   * Login of the user. This is always ASCII.
   */
  login: string;
  /**
   * Display name of the user. This may contain Unicode, e.g. Japanese kana/kanji.
   */
  displayName?: string;
  /**
   * Map of badges.
   *
   * Example: `badges=subscriber/0,broadcaster/1` will result in:
   * ```json
   * {
   *   "subscriber": 0,
   *   "broadcaster": 1
   * }
   * ```
   */
  badges: Record<string, string>;
  /**
   * Map of badge infos.
   *
   * This has the same format as `badges`, but contains more specific information,
   * e.g. for `subscriber`, contains the exact number of subscribed months in `version`.
   */
  badgeInfo: Record<string, string>;
  /**
   * Hex string representing the RGB color of the user's name.
   */
  color?: string;
};

export type Emote = {
  id: string;
  range: { start: number; end: number };
};

type ChatEventData = {
  open: void;
  close: void;
  error: unknown;
  privmsg: PrivmsgEvent;
  userstate: UserStateEvent;
};

type WithData = {
  [K in keyof ChatEventData as ChatEventData[K] extends void ? never : K]: ChatEventData[K];
};
type WithoutData = {
  [K in keyof ChatEventData as ChatEventData[K] extends void ? K : never]: ChatEventData[K];
};
