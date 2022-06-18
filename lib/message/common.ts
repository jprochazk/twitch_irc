import { Message } from "../message.ts";
import { ChannelRole } from "../ratelimit.ts";

export type ChatEvent<Type extends string> = {
  raw: Message;
  type: Type;
};

/** Assumes `data` contains all required information for `User` */
export function parseUser(data: Message): User {
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

export function parseRole(badges: Record<string, string>): ChannelRole {
  if ("broadcaster" in badges) return ChannelRole.Streamer;
  if ("moderator" in badges) return ChannelRole.Moderator;
  if ("vip" in badges) return ChannelRole.VIP;
  if ("subscriber" in badges) return ChannelRole.Subscriber;
  return ChannelRole.Viewer;
}

export function parseBadges(badges: string[]) {
  const result: Record<string, string> = {};
  for (let i = 0; i < badges.length; ++i) {
    const splitIndex = badges[i].indexOf("/");
    const [name, info] = [badges[i].slice(0, splitIndex), badges[i].slice(splitIndex)];
    result[name] = info;
  }
  return result;
}

export function parseEmote(emote: string): Emote {
  const [id, range] = emote.split(":");
  const [start, end] = range.split("-");
  return {
    id,
    range: { start: parseInt(start), end: parseInt(end) },
  };
}

export type Emote = {
  id: string;
  range: { start: number; end: number };
};
