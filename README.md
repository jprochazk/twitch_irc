# twitch_irc

Twitch chat client for Deno

```
$ deno run --allow-net=irc-ws.chat.twitch.tv ./example.ts
```

### Usage

```ts
import { TwitchIrcClient } from "https://deno.land/x/twitch_irc/mod.ts";

const channel = /*...*/;
const use = () => {/*...*/};

const client = new TwitchIrcClient();
client.on("open", () => {
  client.join(channel);
});
client.on("message", (message) => {
  use(message);
});
```

### Features

- Connection management
  - Authentication
  - Automatic reconnect
  - Automatic keep-alive
- Correct message parsing[^1]
- Same message bypass for `PRIVMSG`
- Auto-complete tag names
- Latency measurement
- Strong type safety[^2]

[^1]: Some tag values can have a space in them, and the [example parser by Twitch](https://dev.twitch.tv/docs/irc/example-parser) will not correctly handle that case.
[^2]: The library uses string and template literal types extensively, for example to ensure that a channel has the `#` prefix - similar usage of these advanced type features simplifies the internals of the library greatly, and contributes towards making it less error prone to use.
