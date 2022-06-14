import { TwitchIrcClient } from "./lib/client.ts";

const client = new TwitchIrcClient({ verbose: true });

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
  client.join("#moscowwbish");
});

// @ts-ignore
window.client = client;
