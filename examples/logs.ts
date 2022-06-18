import * as TwitchIrc from "../mod.ts";
import { env } from "./util.ts";

const CHANNEL = env("CHANNEL") as TwitchIrc.Channel;

const client = new TwitchIrc.Client();

client.on("raw", (m) => {
  console.log(m.raw);
});

client.on("open", async () => {
  await client.join(CHANNEL);
  console.log("joined", CHANNEL);
});

// @ts-expect-error: debugging
window.client = client;
