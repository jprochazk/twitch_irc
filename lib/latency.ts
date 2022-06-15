import { nonce } from "./util.ts";
import { type TwitchIrcClient } from "./client.ts";
import { type Message } from "./message.ts";

export class LatencyTest {
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