import { Message } from "../message.ts";
import { ChatEvent } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace Reconnect {
  export function parse(data: Message): Reconnect {
    return {
      raw: data,
      type: "reconnect",
    };
  }
}

export type Reconnect = ChatEvent<"reconnect">;
