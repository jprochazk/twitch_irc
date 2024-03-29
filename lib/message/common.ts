import { Message } from "../message.ts";
import { ChannelRole } from "../ratelimit.ts";
import { splitOnce } from "../util.ts";

export type ChatEvent<Type extends string> = {
  raw: Message;
  type: Type;
};

/**
 * Assumes `data` contains all required information for `User`.
 */
export function parseUser(data: Message): User {
  const id = data.tags!.userId!;
  const badges = parseBadges(data.tag("badges", "csv") ?? []);
  const role = parseRole(badges);
  const login = data.prefix?.nick;
  const badgeInfo = parseBadges(data.tag("badgeInfo", "csv") ?? []);
  const displayName = data.tag("displayName") ?? undefined;
  const color = data.tags!.color;

  const user: User = {
    id,
    role,
    // used in `globaluserstate.ts` where `prefix` doesn't exist, so we assign it credentials.nick instead
    login: login!,
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
    const [name, info] = splitOnce(badges[i], "/");
    result[name] = info!;
  }
  return result;
}

export function parseEmote(emote: string): Emote {
  // 555555558:12-13,15-16,18-19,21-22/1:0-1,3-4,6-7,9-10
  const [id, rawRanges] = emote.split(":");
  const ranges = rawRanges
    .split(",")
    .map((r) => splitOnce(r, "-"))
    .map(([start, end]) => ({ start: parseInt(start), end: parseInt(end!) }));
  return {
    id,
    ranges,
  };
}

export type Emote = {
  id: string;
  ranges: { start: number; end: number }[];
};
