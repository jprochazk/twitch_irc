import { Channel } from "../base.ts";
import { Message } from "../message.ts";
import { parseUser, parseEmote, Emote, User } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace Privmsg {
  export function parse(data: Message): Privmsg {
    return {
      raw: data,
      type: "privmsg",
      channel: data.channel!,
      id: data.tags!.id!,
      roomId: data.tags!.roomId!,
      user: parseUser(data),
      message: data.params.at(-1)!,
      sentAt: data.tag("tmiSentTs", "number")!,
      emotes: data.tags!.emotes?.split("/")?.map(parseEmote) ?? [],
    };
  }
}

export type Privmsg = {
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
