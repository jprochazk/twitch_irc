import { Channel } from "../base.ts";
import { Message } from "../message.ts";
import { ChatEvent } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace ClearChat {
  export function parse(data: Message): ClearChat {
    const result: ClearChat = {
      raw: data,
      type: "clearchat",
      channel: data.channel! as Channel,
      userId: data.tags!.targetUserId!,
      sentAt: data.tag("tmiSentTs", "number")!,
      roomId: data.tags!.roomId!,
    };
    if ("banDuration" in data.tags!) result.banDuration = data.tag("banDuration", "number")!;
    return result;
  }
}

export type ClearChat = ChatEvent<"clearchat"> & {
  channel: Channel;
  userId: string;
  sentAt: number;
  banDuration?: number;
  roomId: string;
};
