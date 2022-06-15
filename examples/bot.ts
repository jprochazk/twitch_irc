import { TwitchIrcClient, Token, Channel } from "../mod.ts";
import { env } from "./util.ts";

const LOGIN = env("LOGIN");
const TOKEN = env("TOKEN") as Token;
const CHANNEL = env("CHANNEL") as Channel;

const client = new TwitchIrcClient({
  capabilities: ["twitch.tv/tags", "twitch.tv/commands"],
  credentials: {
    nick: LOGIN,
    pass: TOKEN as Token,
  },
  verbose: true,
});

client.on("message", (m) => {
  console.log(m.raw);

  if (m.command.kind === "PRIVMSG") {
    const text = m.params.at(-1)!;
    if (text.startsWith("!ping")) {
      client.privmsg(
        CHANNEL,
        `Pong! Hi, ${m.tags?.displayName}. I'm currently running on Deno ${Deno.version.deno}. My latency to TMI is ${client.latency} ms. Your chat color is ${m.tags?.color}.`,
        { replyParentMsgId: m.tags?.id }
      );
    }
  }
});

client.on("open", () => {
  client.join(CHANNEL);
});

// @ts-expect-error: debugging
window.client = client;
