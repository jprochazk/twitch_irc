import { GrowableRingBuffer } from "./ringbuffer.ts";
import { noop } from "./util.ts";
import { Channel, RawMessage } from "./base.ts";
import { RateLimiter } from "./ratelimit.ts";

// TODO: option for message queue to discard messages instead of growing
// TODO: join queue
// TODO: join batching (comma separated channels)

export type Sender<T> = (value: T) => void;

export type DispatchContext = {
  dispatch(ctx: DispatchContext): void;
  timerId: number;
  queue: GrowableRingBuffer<RawMessage>;
  channel: Channel;
};

export class PrivmsgQueue {
  private _rateLimiter: RateLimiter;
  private _channels: Record<Channel, DispatchContext> = {};
  private _sender: Sender<RawMessage>;
  private _timer = {
    set: setTimeout.bind(window),
    clear: clearTimeout.bind(window),
  };

  constructor(sender: Sender<RawMessage>, rateLimiter: RateLimiter) {
    this._rateLimiter = rateLimiter;
    this._sender = sender;
  }

  open(channel: Channel) {
    if (channel in this._channels) return;

    const ctx: DispatchContext = {
      dispatch: noop,
      timerId: -1,
      queue: new GrowableRingBuffer(16),
      channel,
    };

    ctx.dispatch = this._ondispatch.bind(this, ctx);
    ctx.timerId = this._timer.set(ctx.dispatch, 0);

    this._channels[channel] = ctx;
  }

  close(channel: Channel) {
    if (!(channel in this._channels)) return;

    const ctx = this._channels[channel];
    delete this._channels[channel];
    this._timer.clear(ctx.timerId);
  }

  send(message: RawMessage, channel: Channel) {
    const ctx = this._channels[channel];
    if (ctx) {
      ctx.queue.put(message);
    }
  }

  private _ondispatch(ctx: DispatchContext) {
    let remaining = 0;
    while (true) {
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
