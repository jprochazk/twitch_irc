import { Channel } from "../base.ts";
import { Message } from "../message.ts";
import { ChannelRole } from "../ratelimit.ts";
import { ChatEvent, parseBadges, parseRole } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace UserState {
  export function parse(data: Message): UserState {
    const badges = parseBadges(data.tag("badges", "csv") ?? []);
    const result: UserState = {
      raw: data,
      type: "userstate",
      channel: data.channel!,
      role: parseRole(badges),
      emoteSets: data.tag("emoteSets", "csv") ?? [],
      badges,
      badgeInfo: parseBadges(data.tag("badgeInfo", "csv") ?? []),
    };
    if (data.tags?.color) result.color = data.tags.color;
    return result;
  }
}

export type UserState = ChatEvent<"userstate"> & {
  channel: Channel;
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
