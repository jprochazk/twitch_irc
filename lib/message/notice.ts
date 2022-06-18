import { Channel } from "../base.ts";
import { Message } from "../message.ts";
import { ChatEvent } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace Notice {
  export function parse(data: Message, nick: string): Notice {
    const result: Notice = {
      raw: data,
      type: "notice",
      message: data.params.at(-1)!,
    };
    if (data.tags?.msgId) result.msgId = data.tags.msgId;
    if (data.channel) result.channel = data.channel;
    return result;
  }
}

export type Notice = ChatEvent<"notice"> & {
  msgId?: string;
  channel?: Channel;
  message: string;
};
