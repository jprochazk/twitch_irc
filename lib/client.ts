import { Message } from "./message.ts";

export class TwitchIrcClient {
  private _ws: WebSocket;
  private _reconnectDelay = 1000;
  private _channels = new Set<Channel>();
  private _sameMessageBypass = new SameMessageBypass();
  private _listeners: ClientEventCallbackMap = {
    message: new Set(),
    open: new Set(),
    close: new Set(),
    error: new Set(),
  };
  private _latencyTest: LatencyTest = new LatencyTest(this);
  /** Manually closed = do not reconnect */
  private _manuallyClosed = false;
  private _state: State = "connecting";

  private _capabilities: Capability[];
  private _credentials?: Credentials;
  private _reconnect: boolean;
  private _url: string;
  private _logger: Logger;

  constructor(
    options: {
      capabilities?: Capability[];
      /** Credentials used to authenticate. */
      credentials?: Credentials;
      /** Whether or not the client should automatically reconnect. */
      reconnect?: boolean;
      /** The URL to connect to. Used for testing. */
      url?: string;
      /** Whether or not the client should do its own logging. */
      verbose?: boolean;
    } = {}
  ) {
    this._capabilities = options.capabilities ?? [];
    this._credentials = options.credentials;
    this._reconnect = options.reconnect ?? true;
    this._url = options.url ?? "wss://irc-ws.chat.twitch.tv";
    this._logger = options.verbose ? LOGGER : SILENT_LOGGER;

    this._ws = this._create_socket();
  }

  /** Current state of the socket. */
  get state(): State {
    return this._state;
  }

  /** Current latency to the server. */
  get latency(): number {
    return this._latencyTest.value;
  }

  /**
   * Connects an event callback.
   *
   * Available events:
   * - `open` - emitted when the connection opens
   * - `close` - emitted when the connection closes
   * - `message` - emitted when the connection receives a message
   * - `error` - emitted when the connection receives an error
   *
   * `open` and `close` may be sent multiple times, every time the client reconnects.
   */
  on<Type extends keyof ClientEventData>(type: Type, callback: ClientEventCallback<Type>) {
    this._listeners[type].add(callback);
  }

  /**
   * Disconnects an event callback.
   *
   * Available events:
   * - `open` - emitted when the connection opens
   * - `close` - emitted when the connection closes
   * - `message` - emitted when the connection receives a message
   * - `error` - emitted when the connection receives an error
   */
  off<Type extends keyof ClientEventData>(type: Type, callback: ClientEventCallback<Type>) {
    this._listeners[type].delete(callback);
  }

  private _emit<Type extends keyof WithoutData>(type: Type): void;
  private _emit<Type extends keyof WithData>(type: Type, data: WithData[Type]): void;
  // deno-lint-ignore no-explicit-any
  private _emit(type: string, data?: any): void {
    // deno-lint-ignore no-explicit-any
    for (const callback of (this._listeners as any)[type]) {
      if (callback(data)) break;
    }
  }

  /**
   * Send a message.
   *
   * The message must end with `\r\n`.
   */
  send(message: RawMessage) {
    this._ws.send(message);
  }

  /**
   * Sends a `PING` with an optional `arg`, which will be sent back by Twitch with the resulting `PONG`.
   */
  ping(arg?: string) {
    this.send(arg ? `PING :${arg}\r\n` : "PING\r\n");
  }

  /**
   * Sends a `PONG` with an optional `arg`.
   */
  pong(arg?: string) {
    this.send(arg ? `PONG :${arg}\r\n` : "PONG\r\n");
  }

  /**
   * Requests capabilities.
   */
  cap(...capabilities: Capability[]) {
    this.send(`CAP REQ :${capabilities.join(" ")}\r\n`);
  }

  /**
   * Joins `channel`.
   *
   * `channel` must begin with `#`.
   *
   * Any joined channels will be automatically re-joined upon reconnecting.
   */
  join(channel: Channel) {
    if (!this._channels.has(channel)) {
      this.send(`JOIN ${channel}\r\n`);
      this._channels.add(channel);
    }
  }

  /**
   * Leaves `channel`.
   *
   * `channel` must begin with `#`.
   */
  part(channel: Channel) {
    if (this._channels.has(channel)) {
      this.send(`PART ${channel}\r\n`);
      this._channels.delete(channel);
    }
  }

  /**
   * Send a privmsg containing `message` to `channel`.
   *
   * `channel` must begin with `#`.
   */
  privmsg(channel: Channel, message: string) {
    this.send(`PRIVMSG ${channel} :${message}${this._sameMessageBypass.get()}\r\n`);
  }

  /**
   * Close the connection.
   */
  close() {
    this._manuallyClosed = true;
    this._ws.close();
  }

  /**
   * Open the connection.
   *
   * This will only have an effect if you call `close`.
   */
  connect() {
    if (this._manuallyClosed) {
      this._manuallyClosed = false;
      this._ws = this._create_socket();
    }
  }

  private _create_socket(): WebSocket {
    const ws = new WebSocket(this._url);
    ws.onerror = this._onerror;
    ws.onclose = this._onclose;
    ws.onopen = this._onopen;
    ws.onmessage = this._onmessage;
    return ws;
  }

  private _onopen = () => {
    if (this._credentials) {
      this.send(`PASS ${this._credentials.pass}\r\n`);
      this.send(`NICK ${this._credentials.nick}\r\n`);
    } else {
      this.send(`PASS amogus\r\n`);
      this.send(`NICK justinfan37982\r\n`);
    }

    if (this._capabilities.length > 0) {
      this.cap(...this._capabilities);
    }

    for (const channel of this._channels) {
      this.send(`JOIN ${channel}\r\n`);
    }

    this._latencyTest.start();
    this._emit("open");
    this._state = "open";
    this._reconnectDelay = 1000;
  };

  private _onmessage = (event: MessageEvent<string>) => {
    for (const raw of event.data.split("\r\n").filter(Boolean)) {
      const message = Message.parse(raw);
      if (!message) {
        this._logger.warn("Failed to parse message:\n", raw);
        continue;
      }
      if (message.command.kind === "PING" && message.params[0] === "tmi.twitch.tv") {
        this.send("PONG :tmi.twitch.tv\r\n");
        continue;
      }

      this._emit("message", message);
    }
  };

  private _onclose = async () => {
    this._logger.info("Connection closed");
    this._emit("close");
    this._state = "closed";
    this._latencyTest.stop();

    if (this._manuallyClosed) {
      return;
    }

    if (this._reconnect) {
      this._logger.info(`Reconnecting in ${this._reconnectDelay / 1000}s`);
      await sleep(this._reconnectDelay);
      if (this._reconnectDelay < 10000) this._reconnectDelay += 1000;
      this._logger.info("Reconnecting...");

      this._state = "reconnecting";
      this._ws = this._create_socket();
    }
  };

  private _onerror = (error: unknown) => {
    this._logger.error("Error:", error);
    this._emit("error", error);
  };
}

type ClientEventData = {
  message: Message;
  open: void;
  close: void;
  error: unknown;
};

type WithData = {
  [K in keyof ClientEventData as ClientEventData[K] extends void ? never : K]: ClientEventData[K];
};
type WithoutData = {
  [K in keyof ClientEventData as ClientEventData[K] extends void ? K : never]: ClientEventData[K];
};

type ClientEventCallback<K extends keyof ClientEventData> = ClientEventData[K] extends void
  ? () => void
  : (data: ClientEventData[K]) => void;

type ClientEventCallbackMap = {
  [K in keyof ClientEventData]: Set<ClientEventCallback<K>>;
};

export type State = "connecting" | "open" | "reconnecting" | "closed";

export type RawMessage = `${string}\r\n`;

export type Capability = "twitch.tv/commands" | "twitch.tv/tags" | "twitch.tv/membership";

export type Credentials = {
  nick: string;
  pass: string;
};

export type Channel = `#${string}`;

class LatencyTest {
  private _value = 100 /* ms */;
  private _start = Date.now() /* ms */;
  private _arg = nonce();
  private _pingInterval = -1;

  constructor(private client: TwitchIrcClient) {
    this.client.on("message", this._onmessage);
  }

  get value() {
    return this._value;
  }

  start() {
    this._pingInterval = setInterval(this._interval, 5000);
  }

  stop() {
    clearInterval(this._pingInterval);
    this._pingInterval = -1;
  }

  private _onmessage = ({ command, params }: Message) => {
    if (command.kind === "PONG" && params[1] === this._arg) {
      this._value = Date.now() - this._start;
      return true;
    }
  };

  private _interval = () => {
    this._start = Date.now();
    this.client.ping(this._arg);
  };
}

class SameMessageBypass {
  private static CHARS = [
    "",
    // NOTE: second space is `U+2800`
    " ⠀",
  ];
  private flag = 0;

  get() {
    const current = this.flag;
    this.flag = +!this.flag;
    return SameMessageBypass.CHARS[current];
  }
}

interface Logger {
  // deno-lint-ignore no-explicit-any
  info(...args: any[]): void;
  // deno-lint-ignore no-explicit-any
  error(...args: any[]): void;
  // deno-lint-ignore no-explicit-any
  warn(...args: any[]): void;
}

function noop() {}

const SILENT_LOGGER: Logger = {
  info: noop,
  error: noop,
  warn: noop,
};

const LOGGER: Logger = {
  info(...args) {
    console.info("[twitch_irc]", ...args);
  },
  error(...args) {
    console.error("[twitch_irc]", ...args);
  },
  warn(...args) {
    console.warn("[twitch_irc]", ...args);
  },
};

const sleep = (delay: number) => new Promise((done) => setTimeout(done, delay));

const nonce = (length = 32) =>
  [...crypto.getRandomValues(new Uint8Array(length / 2))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
