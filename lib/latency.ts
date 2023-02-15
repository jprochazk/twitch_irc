import { nonce } from "./util.ts";
import { type BaseClient } from "./base.ts";
import { type Message } from "./message.ts";

export class LatencyTest {
  private _value = 100 /* ms */;
  private _start = Date.now() /* ms */;
  private _arg = nonce();
  // deno-lint-ignore no-explicit-any
  private _pingInterval: any = null;

  constructor(private client: BaseClient) {
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
    this._pingInterval = null;
  }

  private _onmessage = ({ command, params }: Message) => {
    if (command.kind === "PONG" && params[1] === this._arg) {
      this._value = Date.now() - this._start;
      return true;
    }
  };

  private _interval = () => {
    this._start = Date.now();
    this.client.send(`PING :${this._arg}\r\n`);
  };
}
