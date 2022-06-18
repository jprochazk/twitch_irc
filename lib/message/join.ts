import { Channel } from "../base.ts";
import { Message } from "../message.ts";
import { ChatEvent } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace Join {
  export function parse(data: Message): Join {
    return {
      raw: data,
      type: "join",
      channel: data.channel! as Channel,
      user: data.prefix!.nick!,
    };
  }
}

export type Join = ChatEvent<"join"> & {
  channel: Channel;
  user: string;
};
