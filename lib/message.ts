import { type Channel } from "./base.ts";
import { KebabToCamelCase, kebabToCamelCase, splitOnce } from "./util.ts";
export class Message {
  private constructor(
    /**
     * The value that was passed into `Message.parse`.
     */
    public raw: string,
    /**
     * Message command. This represents the type of the message, or what its intent is.
     */
    public command: IrcCommand,
    /**
     * Message params. Used for storing command parameters, such as the channel or message.
     *
     * For example, to obtain the message text of a `privmsg`:
     * ```ts
     * message.params.at(-1)
     * ```
     */
    public params: string[],
    /**
     * Message tags. These contain the message's metadata.
     *
     * You can find documentation for all Twitch IRC tags over at https://dev.twitch.tv/docs/irc/tags.
     */
    public tags?: Tags,
    /**
     * Message prefix, for `privmsg`, this contains the user's login.
     * Alternatively, you can get both their display name and login from tags.
     */
    public prefix?: Prefix,
    /** Name of the channel where this message originated */
    public channel?: Channel,
  ) {}

  /**
   * Get a tag preprocessed according to `type`
   *
   * - `csv` - parses the value as a comma separated list of strings. Use for tags such as `badges` or `emotes`
   * - `number` - parses the value as a number. Use for tags such as `tmi-sent-ts`
   * - `bool` - parses the value as a number, then maps `1` to `true`, and anything else to `false`. Use for tags such as `emote-only`.
   * - `string` - this is the default, it unescapes[^1] the value. Use for tags such as `system-msg`
   *
   * [^1]: Unescaping is the process of converting escaped characters, such as `\s` and `\n`,
   * into the characters they represent.
   */
  tag<T extends keyof TagTypes = "string">(
    key: keyof KnownTags,
    type?: T,
  ): TagTypes[T] | null;
  /**
   * Get a tag preprocessed according to `type`
   *
   * - `csv` - parses the value as a comma separated list of strings. Use for tags such as `badges` or `emotes`
   * - `number` - parses the value as a number. Use for tags such as `tmi-sent-ts`
   * - `bool` - parses the value as a number, then maps `1` to `true`, and anything else to `false`. Use for tags such as `emote-only`.
   * - `string` - this is the default, it unescapes[^1] the value. Use for tags such as `system-msg`
   *
   * [^1]: Unescaping is the process of converting escaped characters, such as `\s` and `\n`,
   * into the characters they represent.
   */
  tag<T extends keyof TagTypes = "string">(
    key: string,
    type?: T,
  ): TagTypes[T] | null;
  tag<T extends keyof TagTypes = "string">(
    key: keyof KnownTags | string,
    type?: T,
  ): TagTypes[T] | null {
    const v = this.tags?.[key];
    if (!v) return null;
    if (type === "csv") return v.split(",") as TagTypes[T];
    if (type === "number") return Number(v) as TagTypes[T];
    if (type === "bool") return (Number(v) === 1) as TagTypes[T];
    // type = "string" | undefined
    // in both cases we want to treat it as a string
    return unescape(v) as TagTypes[T];
  }

  /**
   * Parse a Twitch IRC message.
   *
   * See `message.test.ts` for some examples.
   */
  static parse(message: string) {
    let tags: Tags | undefined;
    let prefix: Prefix | undefined;
    let command: IrcCommand;
    let channel: Channel | undefined;
    let params: string[] | undefined;

    let remainder = message.trimEnd();

    tags:
    if (remainder.startsWith("@")) {
      remainder = remainder.slice(1);
      const [tagsRaw, maybeRemainder] = splitOnce(remainder, " :");
      if (!maybeRemainder) break tags;
      remainder = maybeRemainder;
      tags = {};

      const tagPairs = tagsRaw.split(";");
      for (let i = 0; i < tagPairs.length; ++i) {
        const tagPair = tagPairs[i];
        const [key, value] = splitOnce(tagPair, "=");
        if (!value) continue;
        // @ts-expect-error: initializing tags requires mutating them
        tags[kebabToCamelCase(key)] = value;
      }
    }

    prefix:
    if (remainder.startsWith(":")) {
      remainder = remainder.slice(1);
      const [prefixRaw, maybeRemainder] = splitOnce(remainder, " ");
      if (!maybeRemainder) break prefix;
      remainder = maybeRemainder;

      const [left, host] = splitOnce(prefixRaw, "@");
      if (!host) {
        prefix = { host: left };
        break prefix;
      }

      const [nick, user] = splitOnce(left, "!");
      if (!user) {
        prefix = { nick, host };
        break prefix;
      }
      prefix = { nick, user, host };
    }

    /* command: */ {
      const [rawCommand, maybeRemainder] = splitOnce(remainder, " ");
      remainder = maybeRemainder ?? "";

      if (ircCommandSet.has(rawCommand)) {
        command = { kind: rawCommand as IrcCommandKind };
      } else {
        command = { kind: "UNKNOWN", raw: rawCommand };
      }
    }

    /* channel: */ if (remainder.startsWith("#")) {
      const [rawChannel, maybeRemainder] = splitOnce(remainder, " ");
      channel = rawChannel as Channel;
      remainder = maybeRemainder ?? "";
    }

    params: {
      remainder = remainder.trimStart();
      if (remainder.length === 0) {
        params = [];
        break params;
      }

      if (remainder.startsWith(":")) {
        params = [remainder.slice(1)];
        break params;
      }

      const [rawParams, lastParam] = splitOnce(remainder, " :");
      if (!lastParam) {
        params = rawParams.split(" ");
        break params;
      }
      params = rawParams.split(" ");
      params.push(lastParam.slice(1));
    }

    return new Message(message, command, params, tags, prefix, channel);
  }
}

type TagTypes = {
  "string": string;
  "number": number;
  "csv": string[];
  "bool": boolean;
};

/**
 * Unescape an escaped tag value.
 *
 * Unescaping is the process of converting escaped characters, such as `\s` and `\n`,
 * into the characters they represent.
 */
export function unescape(str: string): string {
  let out = "";
  let escape = false;
  loop:
  for (const c of str) {
    if (escape) {
      // prettier-ignore
      switch (c) {
        case ":":
          out = out.concat(";");
          escape = false;
          continue loop;
        case "s":
          out = out.concat(" ");
          escape = false;
          continue loop;
        case "\\":
          out = out.concat("\\");
          escape = false;
          continue loop;
        case "r":
          out = out.concat("\r");
          escape = false;
          continue loop;
        case "n":
          out = out.concat("\n");
          escape = false;
          continue loop;
      }
    }

    if (c === "⸝") {
      out = out.concat(",");
    } else if (c === "\\") {
      escape = true;
    } else {
      out = out.concat(c);
    }
  }
  return out;
}

const knownIrcTags = [
  "msg-id",
  "badges",
  "badge-info",
  "display-name",
  "emote-only",
  "emotes",
  "flags",
  "id",
  "mod",
  "room-id",
  "subscriber",
  "tmi-sent-ts",
  "turbo",
  "user-id",
  "user-type",
  "client-nonce",
  "first-msg",
  "reply-parent-display-name",
  "reply-parent-msg-body",
  "reply-parent-msg-id",
  "reply-parent-user-id",
  "reply-parent-user-login",
  "followers-only",
  "r9k",
  "rituals",
  "slow",
  "subs-only",
  "msg-param-cumulative-months",
  "msg-param-displayName",
  "msg-param-login",
  "msg-param-months",
  "msg-param-promo-gift-total",
  "msg-param-promo-name",
  "msg-param-recipient-display-name",
  "msg-param-recipient-id",
  "msg-param-recipient-user-name",
  "msg-param-sender-login",
  "msg-param-sender-name",
  "msg-param-should-share-streak",
  "msg-param-streak-months",
  "msg-param-sub-plan",
  "msg-param-sub-plan-name",
  "msg-param-viewerCount",
  "msg-param-ritual-name",
  "msg-param-threshold",
  "msg-param-gift-months",
  "login",
  "system-msg",
  "emote-sets",
  "thread-id",
  "message-id",
  "ban-duration",
  "target-msg-id",
  "bits",
  "color",
  "extendsub",
  "custom-reward-id",
  "target-user-id",
] as const;

type KnownTags = {
  readonly [K in typeof knownIrcTags[number] as KebabToCamelCase<K>]?: string;
};

type Tags = KnownTags & {
  readonly [tag: string]: string;
};

export type IrcCommand = { kind: IrcCommandKind } | {
  kind: "UNKNOWN";
  raw: string;
};

const ircCommands = [
  "PING",
  "PONG",
  "JOIN",
  "PART",
  "PRIVMSG",
  "WHISPER",
  "CLEARCHAT",
  "CLEARMSG",
  "GLOBALUSERSTATE",
  "HOSTTARGET",
  "NOTICE",
  "RECONNECT",
  "ROOMSTATE",
  "USERNOTICE",
  "USERSTATE",
  "CAP",
] as const;

const ircCommandSet = new Set<string>(ircCommands);

export type IrcCommandKind = typeof ircCommands[number];

export type Prefix = {
  nick?: string;
  user?: string;
  host: string;
};
