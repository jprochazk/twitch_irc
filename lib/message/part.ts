import { Channel } from "../base.ts";
import { Message } from "../message.ts";
import { ChatEvent } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace Part {
  export function parse(data: Message): Part {
    return {
      raw: data,
      type: "part",
      channel: data.channel! as Channel,
      user: data.prefix!.nick!,
    };
  }
}

export type Part = ChatEvent<"part"> & {
  channel: Channel;
  user: string;
};
