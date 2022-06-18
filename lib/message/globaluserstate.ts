import { Message } from "../message.ts";
import { ChatEvent, parseUser, User } from "./common.ts";

// deno-lint-ignore no-namespace
export namespace GlobalUserState {
  export function parse(data: Message, nick: string): GlobalUserState {
    const user = parseUser(data);
    user.login = nick;
    return {
      raw: data,
      type: "globaluserstate",
      user,
      emoteSets: data.tag("emoteSets", "csv") ?? [],
    };
  }
}

export type GlobalUserState = ChatEvent<"globaluserstate"> & {
  user: User;
  emoteSets: string[];
};
