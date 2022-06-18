import * as TwitchIrc from "../mod.ts";
import { env } from "./util.ts";

const LOGIN = env("LOGIN");
const TOKEN = env("TOKEN") as TwitchIrc.Token;
const CHANNEL = env("CHANNEL") as TwitchIrc.Channel;

const client = new TwitchIrc.Client({
  credentials: {
    nick: LOGIN,
    pass: TOKEN,
  },
});

client.on("raw", (e) => console.log(e.raw));

client.on("privmsg", (event) => {
  //console.log(event);
  if (event.message.startsWith("!ping")) {
    client.privmsg(
      CHANNEL,
      `Pong! Hi, ${event.user.displayName ?? event.user.login}. ` +
        `I'm currently running on Deno ${Deno.version.deno}. ` +
        `My latency to TMI is ${client.latency} ms. ` +
        `Your chat color is ${event.user.color ?? "unknown"}.`,
      { replyParentMsgId: event.id }
    );
  }
});

client.on("open", () => {
  client.join(CHANNEL);
});

// @ts-expect-error: debugging
window.client = client;
