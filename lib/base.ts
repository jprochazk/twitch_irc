import { Message } from "./message.ts";
import { sleep } from "./util.ts";

/**
 * Wrapper over a WebSocket connection to TMI.
 *
 * Features:
 * - Authentication/handshake
 * - Reconnecting when connection is lost
 * - Negotiating capabilities
 * - Parsing IRC messages
 *
 * Unless you have a good reason to, you should use `Client` in `lib/client.ts` instead of this.
 */
export class BaseClient {
  private _ws: WebSocket;
  private _reconnectDelay = 1000;
  private _listeners: ClientEventCallbackMap = {
    message: new Set(),
    open: new Set(),
    close: new Set(),
    error: new Set(),
  };
  /** Manually closed = do not reconnect */
  private _manuallyClosed = false;
  private _state: State = "connecting";

  private _capabilities: Capability[];
  private _credentials: Credentials;
  private _reconnect: boolean;
  private _url: string;

  constructor(
    options: {
      capabilities?: Capability[];
      /**
       * Credentials used to authenticate.
       *
       * If configured, the bot will also join its own channel by joining `#${credentials.login}`.
       */
      credentials?: Credentials;
      /** Whether or not the client should automatically reconnect. */
      reconnect?: boolean;
      /** The URL to connect to. Used for testing. */
      url?: string;
    } = {}
  ) {
    this._capabilities = options.capabilities ?? [];
    this._credentials = options.credentials ?? {
      nick: `justinfan${Math.floor(Math.random() * 89999 + 10000)}`,
      // deno-lint-ignore no-explicit-any
      pass: "amogus" as any,
    };
    this._reconnect = options.reconnect ?? true;
    this._url = options.url ?? "wss://irc-ws.chat.twitch.tv";

    this._ws = this._create_socket();
  }

  /** Current state of the socket. */
  get state(): State {
    return this._state;
  }

  get socketReadyState(): number {
    return this._ws.readyState;
  }

  get nick(): string {
    return this._credentials.nick;
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
    ws.onmessage = this._onauthmessage;
    return ws;
  }

  private _onopen = () => {
    this._state = "authenticating";
    if (this._credentials) {
      this.send(`PASS ${this._credentials.pass}\r\n`);
      this.send(`NICK ${this._credentials.nick}\r\n`);
    } else {
      this.send(`PASS amogus\r\n`);
      this.send(`NICK justinfan37982\r\n`);
    }
    if (this._capabilities.length > 0) {
      this.send(`CAP REQ :${this._capabilities.join(" ")}\r\n`);
    }
  };

  private _onauthmessage = (event: MessageEvent<string>) => {
    for (const raw of event.data.split("\r\n").filter(Boolean)) {
      const message = Message.parse(raw);
      if (this.state === "authenticating") {
        if (
          message.command.kind === "NOTICE" &&
          message.params.at(-1)?.includes("authentication failed")
        ) {
          // failure
          this._onerror(new Error("Invalid credentials"));
          this.close();
        } else if (message.command.kind === "UNKNOWN" && message.command.raw === "001") {
          // success
          this._onconnectedmessage(event);
          this._ws.onmessage = this._onconnectedmessage;
          this._state = "open";
          this._reconnectDelay = 1000;
          this._emit("open");
          break;
        }
      }
    }
  };
  private _onconnectedmessage = (event: MessageEvent<string>) => {
    for (const raw of event.data.split("\r\n").filter(Boolean)) {
      const message = Message.parse(raw);
      if (message.command.kind === "PING" && message.params[0] === "tmi.twitch.tv") {
        this.send("PONG :tmi.twitch.tv\r\n");
        continue;
      }

      this._emit("message", message);
    }
  };

  private _onclose = async () => {
    this._emit("close");
    this._state = "closed";

    if (this._manuallyClosed) {
      return;
    }

    if (this._reconnect) {
      await sleep(this._reconnectDelay);
      if (this._reconnectDelay < 10000) this._reconnectDelay += 1000;

      this._state = "reconnecting";
      this._ws = this._create_socket();
    }
  };

  private _onerror = (error: unknown) => {
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

export type State = "connecting" | "authenticating" | "open" | "reconnecting" | "closed";

export type RawMessage = `${string}\r\n`;

export type Capability = "twitch.tv/commands" | "twitch.tv/tags" | "twitch.tv/membership";

export type Token = `oauth:${string}`;
export type Credentials = {
  nick: string;
  pass: Token;
};

export type Channel = `#${string}`;
