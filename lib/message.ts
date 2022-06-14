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
    public channel?: Channel
  ) {}

  /**
   * Get a tag preprocessed according to `type`
   *
   * - `csv` - parses the value as a comma separated list of strings, use for tags such as `badges` or `emotes`
   * - `number` - parses the value as a number, use for tags such as `tmi-sent-ts`
   * - `string` - this is the default, it unescapes[^1] the value, use for tags such as `system-msg`
   *
   * [^1]: Unescaping is the process of converting escaped characters,
   * such as `\s` and `\n`, into the characters they represent.
   */
  tag<T extends TagTypes = "string">(key: keyof KnownTags, type?: T): TagType<T> | null;
  /**
   * Get a tag preprocessed according to `type`
   *
   * - `csv` - parses the value as a comma separated list of strings, use for tags such as `badges` or `emotes`
   * - `number` - parses the value as a number, use for tags such as `tmi-sent-ts`
   * - `string` - this is the default, it unescapes[^1] the value, use for tags such as `system-msg`
   *
   * [^1]: Unescaping is the process of converting escaped characters, such as `\s` and `\n`,
   * into the characters they represent.
   */
  tag<T extends TagTypes = "string">(key: string, type?: T): TagType<T> | null;
  tag<T extends TagTypes = "string">(key: keyof KnownTags | string, type?: T): TagType<T> | null {
    const v = this.tags?.[key];
    if (!v) return null;
    if (type === "csv") return v.split(",") as TagType<T>;
    if (type === "number") return Number(v) as TagType<T>;
    // type = "string" | undefined
    // in both cases we want to treat it as a string
    return unescape(v) as TagType<T>;
  }

  /**
   * Parse a Twitch IRC message.
   *
   * See `message.test.ts` for some examples.
   */
  static parse(message: string): Message | null {
    let tags: Tags | undefined;
    let prefix: Prefix | undefined;
    let command: IrcCommand;
    let channel: Channel | undefined;
    let params: string[] | undefined;

    let remainder = message.trimEnd();

    tags: if (remainder.startsWith("@")) {
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

    prefix: if (remainder.startsWith(":")) {
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

type Channel = `#${string}`;

type TagTypes = "string" | "number" | "csv";
type TagType<T extends TagTypes> = T extends "string"
  ? string
  : T extends "number"
  ? number
  : T extends "csv"
  ? string[]
  : never;

/**
 * Unescape an escaped tag value.
 *
 * Unescaping is the process of converting escaped characters, such as `\s` and `\n`,
 * into the characters they represent.
 */
export function unescape(str: string): string {
  let out = "";
  let escape = false;
  loop: for (const c of str) {
    if (escape) {
      // prettier-ignore
      switch (c) {
      case ":": out = out.concat(";"); escape = false; continue loop;
      case "s": out = out.concat(" "); escape = false; continue loop;
      case "\\": out = out.concat("\\"); escape = false; continue loop;
      case "r": out = out.concat("\r"); escape = false; continue loop;
      case "n": out = out.concat("\n"); escape = false; continue loop;
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

/**
 * Splits `str` by `delimiter`
 *
 * If `delimiter.length > 1`, the right side will contain everything past the first character of the delimiter.
 * For example:
 * ```ts
 * const [a, b] = splitOnce("test :test", " :");
 * assert(a === "test");
 * assert(b === ":test");
 * ```
 */
function splitOnce(str: string, delimiter: string): [string, string | null] {
  const index = str.indexOf(delimiter);
  if (index === -1) return [str, null];
  else return [str.slice(0, index), str.slice(index + 1)];
}

/**
 * Converts a string from `kebab-case` into `lowerCamelCase`.
 *
 * E.g. `reply-parent-display-name` is converted to `replyParentDisplayName`.
 */
function kebabToCamelCase(str: string): string {
  const parts = str.split("-");
  if (parts.length > 1) {
    parts[0] = parts[0].toLowerCase();
    for (let i = 1; i < parts.length; ++i) {
      parts[i] = parts[i].slice(0, 1).toUpperCase() + parts[i].slice(1).toLowerCase();
    }
  }
  return parts.join("");
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
] as const;
type KebabToCamelCase<K extends string> = K extends `${infer Left}-${infer Right}`
  ? `${Lowercase<Left>}${Capitalize<KebabToCamelCase<Right>>}`
  : `${Lowercase<K>}`;
type KnownTags = {
  readonly [K in typeof knownIrcTags[number] as KebabToCamelCase<K>]?: string;
};
type Tags = KnownTags & {
  readonly [tag: string]: string;
};

export type IrcCommand = { kind: IrcCommandKind } | { kind: "UNKNOWN"; raw: string };

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

// @ts-ignore: temporary
window.Message = Message;
