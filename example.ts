import { TwitchIrcClient, Channel } from "./mod.ts";

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
  const channel = Deno.env.get("CHANNEL");
  if (channel && channel.startsWith("#")) {
    client.join(channel as Channel);
  }
});

// @ts-ignore
window.client = client;
