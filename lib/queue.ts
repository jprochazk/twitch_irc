import { GrowableRingBuffer } from "./ringbuffer.ts";
import { noop } from "./util.ts";
import { Channel, RawMessage } from "./base.ts";
import { RateLimiter } from "./ratelimit.ts";

export class JoinQueue {
  private _rateLimiter: RateLimiter;
  private _sender: Sender<RawMessage>;
  private _timer = {
    set: setTimeout.bind(window),
    clear: clearTimeout.bind(window),
  };
  private _paused = false;
  private _timerId: number;
  private _queue = new GrowableRingBuffer<RawMessage>(16);

  constructor(sender: Sender<RawMessage>, rateLimiter: RateLimiter) {
    this._rateLimiter = rateLimiter;
    this._sender = sender;
    this._timerId = this._timer.set(this._ondispatch, 0);
  }

  send(message: RawMessage) {
    this._queue.put(message);
  }

  pause(v: boolean) {
    this._paused = v;
  }

  clear() {
    this._queue.clear();
  }

  private _ondispatch = () => {
    let remaining = 0;
    while (true) {
      if (this._paused) {
        remaining = 1000;
        break;
      }
      const message = this._queue.peek();
      if (!message) break;
      remaining = this._rateLimiter.join(Date.now());
      if (remaining > 0) {
        break;
      }
      this._sender(message);
      this._queue.get();
    }
    this._timerId = this._timer.set(this._ondispatch, remaining);
  };
}

export class PrivmsgQueue {
  private _rateLimiter: RateLimiter;
  private _channels: Record<Channel, PrivmsgDispatchContext> = {};
  private _sender: Sender<RawMessage>;
  private _timer = {
    set: setTimeout.bind(window),
    clear: clearTimeout.bind(window),
  };
  private _getSocketState: GetSocketState;

  constructor(
    sender: Sender<RawMessage>,
    rateLimiter: RateLimiter,
    getSocketState: GetSocketState
  ) {
    this._rateLimiter = rateLimiter;
    this._sender = sender;
    this._getSocketState = getSocketState;
  }

  open(channel: Channel) {
    if (channel in this._channels) return;

    const ctx: PrivmsgDispatchContext = {
      dispatch: noop,
      timerId: -1,
      queue: new GrowableRingBuffer(16),
      channel,
    };

    ctx.dispatch = this._ondispatch.bind(this, ctx);
    ctx.timerId = this._timer.set(ctx.dispatch, 0);

    this._channels[channel] = ctx;
  }

  /**
   * Queue `message` to be sent to `channel`.
   *
   * If `channel` is not open, this will open it before queueing the message.
   */
  send(message: RawMessage, channel: Channel) {
    if (!(channel in this._channels)) {
      this.open(channel);
    }
    this._channels[channel].queue.put(message);
  }

  private _ondispatch(ctx: PrivmsgDispatchContext) {
    let remaining = 0;
    while (true) {
      if (this._getSocketState() !== WebSocket.OPEN) {
        remaining = 1000;
        break;
      }
      const message = ctx.queue.peek();
      if (!message) break;
      remaining = this._rateLimiter.privmsg(Date.now(), ctx.channel);
      if (remaining > 0) {
        break;
      }
      this._sender(message);
      ctx.queue.get();
    }
    ctx.timerId = this._timer.set(ctx.dispatch, remaining);
  }
}

type Sender<T> = (value: T) => void;

type GetSocketState = () => number;

type PrivmsgDispatchContext = {
  dispatch(ctx: PrivmsgDispatchContext): void;
  timerId: number;
  queue: GrowableRingBuffer<RawMessage>;
  channel: Channel;
};
