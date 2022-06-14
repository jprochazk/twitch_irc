import { TwitchIrcClient, Token, Channel } from "../mod.ts";
import { env } from "./util.ts";

const LOGIN = env("LOGIN");
const TOKEN = env("TOKEN") as Token;
const CHANNEL = env("CHANNEL") as Channel;

const client = new TwitchIrcClient({
  capabilities: ["twitch.tv/tags", "twitch.tv/commands"],
  credentials: {
    login: LOGIN,
    token: TOKEN as Token,
  },
  verbose: true,
});

client.on("message", (m) => console.log(m.raw));

client.on("open", () => {
  client.join(CHANNEL);
});

// @ts-expect-error: debugging
window.client = client;
