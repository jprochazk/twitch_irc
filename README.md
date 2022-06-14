# twitch_irc

Twitch chat client for [Deno](https://deno.land/)

```ts
import { TwitchIrcClient, Message } from "https://deno.land/x/twitch_irc/mod.ts";

const channel = /*...*/;
const use = (message: Message) => {/*...*/};

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

### Run an example

```
$ CHANNEL=<your_channel> deno run \
  --allow-env=CHANNEL \
  --allow-net=irc-ws.chat.twitch.tv \
  https://deno.land/x/twitch_irc/example.ts
```

You can also inspect it using devtools:

```
$ CHANNEL=<your_channel> deno run \
  --inspect-brk \
  --allow-env=CHANNEL \
  --allow-net=irc-ws.chat.twitch.tv \
  https://deno.land/x/twitch_irc/example.ts
```

In this case, the client will be available on the window object as `client`.
