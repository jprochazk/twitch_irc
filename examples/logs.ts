import { Bot, Channel } from "../mod.ts";
import { env } from "./util.ts";

const CHANNEL = env("CHANNEL") as Channel;

const client = new Bot();

client.on("privmsg", (m) => {
  console.log(m.raw.raw);
});

client.on("open", () => {
  client.join(CHANNEL);
});

// @ts-expect-error: debugging
window.client = client;
