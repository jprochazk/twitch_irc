import { Channel } from "../base.ts";
import { Message } from "../message.ts";
import { ChatEvent } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace ClearMsg {
  export function parse(data: Message): ClearMsg {
    return {
      raw: data,
      type: "clearmsg",
      channel: data.channel! as Channel,
      login: data.prefix!.nick!,
      text: data.params.at(-1)!,
      targetMsgId: data.tags!.targetMsgId!,
    };
  }
}

export type ClearMsg = ChatEvent<"clearmsg"> & {
  channel: Channel;
  login: string;
  text: string;
  targetMsgId: string;
};
