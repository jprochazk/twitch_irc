import { GrowableRingBuffer } from "./ringbuffer.ts";
import { noop } from "./util.ts";
import { Channel, RawMessage } from "./base.ts";
import { RateLimiter } from "./ratelimit.ts";

// TODO: option for message queue to discard messages instead of growing
// TODO: join queue
// TODO: join batching (comma separated channels)
// TODO: handle JOIN and PART commands to figure out which channels the bot is actually in

type Sender<T> = (value: T) => void;

type GetSocketState = () => number;

type DispatchContext = {
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

  /**
   * Queue `message` to be sent to `channel`.
   *
   * If `channel` is not open, this will open it before queueing the message.
   */
  send(message: RawMessage, channel: Channel) {
    const ctx = this._channels[channel];
    if (!ctx) this.open(channel);
    ctx.queue.put(message);
  }

  private _ondispatch(ctx: DispatchContext) {
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
