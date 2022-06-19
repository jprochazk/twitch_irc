import { Channel } from "../base.ts";
import { Message } from "../message.ts";
import { ChatEvent } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace RoomState {
  export function parse(data: Message): RoomState {
    return {
      raw: data,
      type: "roomstate",
      channel: data.channel! as Channel,
      emote: data.tag("emoteOnly", "bool"),
      followers: data.tag("followersOnly", "number"),
      r9k: data.tag("r9k", "bool"),
      slow: data.tag("slow", "number"),
      sub: data.tag("subsOnly", "bool"),
    };
  }
}

/**
 * Roomstate event.
 *
 * Note that roomstates may be partial, as in not all settings may be present
 * in the roomstate command - this does *not* mean they are disabled.
 */
export type RoomState = ChatEvent<"roomstate"> & {
  channel: Channel;
  /**
   * Emote-only mode (messages may contain only Twitch emotes).
   *
   * Values:
   * - `null` -> unchanged from previous roomstate
   * - `true` -> enabled
   * - `false` -> disabled
   */
  emote: boolean | null;
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
  followers: number | null;
  /**
   * R9K mode - messages with more than 9 characters must be globally unique
   *
   * Values:
   * - `null` -> unchanged from previous roomstate
   * - `true` -> enabled
   * - `false` -> disabled
   */
  r9k: boolean | null;
  /**
   * Slow mode - each user may only send a message every `value` seconds
   *
   * Values:
   * - `null` -> unchanged from previous roomstate
   * - `0` -> disabled
   * - `> 0` -> enabled (value determines the duration)
   */
  slow: number | null;

  /**
   * Sub-only mode - only subscribers may chat.
   *
   * Values:
   * - `null` -> unchanged from previous roomstate
   * - `true` -> enabled
   * - `false` -> disabled
   */
  sub: boolean | null;
};
