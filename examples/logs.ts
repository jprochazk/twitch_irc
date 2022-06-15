import { TwitchIrcClient, Channel } from "../mod.ts";
import { env } from "./util.ts";

const CHANNEL = env("CHANNEL") as Channel;

const client = new TwitchIrcClient({ verbose: false });

client.on("message", (m) => {
  console.log(
    ...[
      m.command.kind === "UNKNOWN" ? `(${m.command.raw})` : m.command.kind,
      m.channel && m.channel,
      m.prefix?.nick,
      "->",
      m.params.join(" "),
    ].filter(Boolean)
  );
});

client.on("open", () => {
  client.join(CHANNEL);
});

// @ts-expect-error: debugging
window.client = client;
