import { Bot, Token, Channel } from "../mod.ts";
import { env } from "./util.ts";

const LOGIN = env("LOGIN");
const TOKEN = env("TOKEN") as Token;
const CHANNEL = env("CHANNEL") as Channel;

const client = new Bot({
  credentials: {
    nick: LOGIN,
    pass: TOKEN as Token,
  },
});

client.on("privmsg", (event) => {
  event = { ...event };
  // @ts-expect-error: make the log easier to read
  delete event.raw;
  console.log(event);

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
