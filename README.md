# twitch_irc

Twitch chat client

### Usage in [Deno](https://deno.land/)

```ts
import * as TwitchIrc from "https://deno.land/x/twitch_irc/mod.ts";

const channel = /*...*/;
const nick = /*...*/;
const pass = /*...*/;

const client = new TwitchIrc.Client({
  credentials: { nick, pass }
});
client.on("privmsg", ({ user, message }) => {
  console.log(`${user.login}: ${message}`);
});
client.on("open", () => {
  client.join(channel);
});
```

### Usage in [Node](https://nodejs.org/)

```
$ npm install twitch_irc@npm:@jprochazk/twitch_irc
```

ESM:

```ts
// index.mjs
// or index.js, but with "type":"module" in package.json
import * as TwitchIrc from "twitch_irc";

const channel = /*...*/;
const nick = /*...*/;
const pass = /*...*/;

const client = new TwitchIrc.Client({
  credentials: { nick, pass }
});
client.on("privmsg", ({ user, message }) => {
  console.log(`${user.login}: ${message}`);
});
client.on("open", () => {
  client.join(channel);
});
```

CommonJS:

```ts
// index.js
const TwitchIrc = require("twitch_irc");

const channel = /*...*/;
const nick = /*...*/;
const pass = /*...*/;

const client = new TwitchIrc.Client({
  credentials: { nick, pass }
});
client.on("privmsg", ({ user, message }) => {
  console.log(`${user.login}: ${message}`);
});
client.on("open", () => {
  client.join(channel);
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
- Rate limiting

[^1]: Some tag values can have a space in them, and the
[example parser by Twitch](https://dev.twitch.tv/docs/irc/example-parser) will
not correctly handle that case. [^2]: The library uses string and template
literal types extensively, for example to ensure that a channel has the `#`
prefix - similar usage of these advanced type features simplifies the internals
of the library greatly, and contributes towards making it less error prone to
use.

### Examples

Specify the `--inspect-brk` flag to inspect any of the examples using developer
tools. For example, for Chrome it's `chrome://inspect` ->
`Open dedicated DevTools for Node`. The client is available on the window object
as `window.client`.

#### Simple chat logging (anonymous)

Requires the `CHANNEL` environment variable to be specified in the format
`#<name>`, e.g. `#jtv`.

```
$ deno run \
  --allow-env=CHANNEL \
  --allow-net=irc-ws.chat.twitch.tv \
  https://deno.land/x/twitch_irc/examples/logs.ts
```

#### Simple bot

Requires three environment variables:

- `CHANNEL` in the format `#<name>`, e.g. `#jtv`.
- `TOKEN` in the format `oauth:<token>`, e.g. `oauth:abcdefg0123456789`.
  [You can generate one here](https://twitchapps.com/tmi/).
- `LOGIN`, which is the username of the account you used to generate `TOKEN`.

The bot will join `CHANNEL` upon connecting, and you can type `!ping` in command
to have it respond to you. It will also join its own channel.

```
$ deno run \
  --allow-env=CHANNEL,LOGIN,TOKEN \
  --allow-net=irc-ws.chat.twitch.tv \
  https://deno.land/x/twitch_irc/examples/bot.ts
```

### Release process

- Commit latest changes
- Tag with new `version` according to semver
- `deno run -A ./scripts/build_npm.ts <version>` using the same `version`
- `cd npm && npm publish --access=public`
