import { type Channel } from "./base.ts";

const MILLISECOND = 1;
const SECOND = MILLISECOND * 1000;
// const MINUTE = SECOND * 60;
// const HOUR = MINUTE * 60;
// const DAY = HOUR * 24;
// const WEEK = DAY * 7;

export enum AccountStatus {
  Normal,
  Known,
  Verified,
}

export enum ChannelRole {
  Viewer,
  Subscriber,
  VIP,
  Moderator,
  Streamer,
}

export interface RateLimiter {
  /**
   * Returns `0` if a message can be sent, otherwise returns the number of
   * remaining milliseconds until a message can be sent.
   */
  privmsg(now: number, channel: Channel): number;

  /**
   * Returns `0` if a channel can be joined, otherwise returns the number of
   * remaining milliseconds until a channel can be joined.
   */
  join(now: number): number;
}

/**
 * Default chat rate limiter with proper handling of known/verified accounts and vip/mod/streamer per-channel roles.
 * Uses window-based buckets described in the official documentation (https://dev.twitch.tv/docs/irc#rate-limits).
 */
export class DefaultLimiter implements RateLimiter {
  private _privmsg: PrivmsgLimiter;
  private _join: JoinLimiter;

  constructor(options: { status?: AccountStatus } = {}) {
    this._privmsg = new PrivmsgLimiter(options);
    this._join = new JoinLimiter(options);
  }

  privmsg(
    now: number,
    channel: Channel,
    options: { role?: ChannelRole; slowModeSeconds?: number } = {}
  ): number {
    return this._privmsg.get(now, channel, options);
  }

  join(now: number): number {
    return this._join.get(now);
  }
}

const GLOBAL_SLOWMODE_SECONDS = 1.0;

/**
 * Privmsg limiter, handling per-channel message limits based on vip/mod/streamer role,
 * and global limit for verified bots.
 *
 * You should use `DefaultLimiter` unless you have a good reason not to.
 */
export class PrivmsgLimiter {
  private _channels: Record<Channel, { msg: Bucket; slow: Bucket }> = {};
  private _global: Bucket;
  private _status: AccountStatus;

  constructor(options: { status?: AccountStatus } = {}) {
    this._status = options.status ?? AccountStatus.Normal;
    this._global = new Bucket({
      capacity: options.status === AccountStatus.Verified ? 7500 : 20,
      period: 30 * SECOND,
    });
  }

  /**
   * Returns the remaining number of milliseconds until a token is available.
   */
  get(
    now: number,
    channel: Channel,
    options: { slowModeSeconds?: number; role?: ChannelRole } = {}
  ): number {
    const role = options.role ?? ChannelRole.Viewer;
    const slowModeSeconds =
      role >= ChannelRole.VIP ? 0 : (options?.slowModeSeconds ?? GLOBAL_SLOWMODE_SECONDS) * SECOND;

    this._channels[channel] ??= {
      msg: new Bucket({ capacity: 20, period: 30 * SECOND }),
      slow: new Bucket({ capacity: 1, period: slowModeSeconds }),
    };

    const ch = this._channels[channel];
    ch.slow.setPeriod(slowModeSeconds, now);

    // if any bucket is empty, treat all of them as empty,
    // and return the maximum time remaining until a token is available
    const remaining = Math.max(ch.msg.peek(now), ch.slow.peek(now), this._global?.peek(now) ?? 0);
    if (remaining > 0) return remaining;

    // if no bucket is empty, grab a token from all of them at the same time
    ch.msg.get(now);
    ch.slow.get(now);
    this._global?.get(now);
    return 0;
  }
}

/**
 * Join limiter, handling global `JOIN` limits, with correct treatment of known/verified account status.
 *
 * You should use `DefaultLimiter` unless you have a good reason not to.
 */
export class JoinLimiter {
  private _bucket: Bucket;

  constructor(options: { status?: AccountStatus } = {}) {
    this._bucket = new Bucket({
      capacity: options.status === AccountStatus.Verified ? 2000 : 20,
      period: 10 * SECOND,
    });
  }

  /**
   * Returns the remaining number of milliseconds until a token is available.
   */
  get(now: number) {
    return this._bucket.get(now);
  }
}

/**
 * Rate limiter which holds a bucket of tokens that periodically refills back to its full capacity.
 *
 * This is the data structure used to hand out tokens.
 */
export class Bucket {
  private _lastRefresh: number;
  private _tokens: number;
  private _capacity: number;
  private _period: number;

  constructor(options: { capacity: number; period: number }) {
    this._capacity = options.capacity;
    this._period = options.period;
    this._lastRefresh = 0;
    this._tokens = this._capacity;
  }

  peek(now: number): number {
    if (this._tokens > 0) {
      return 0;
    }

    return this._period - (now - this._lastRefresh);
  }

  /**
   * Returns the remaining number of milliseconds until a token is available.
   */
  get(now: number): number {
    if (now - this._lastRefresh >= this._period) {
      this._tokens = this._capacity;
      this._lastRefresh = now;
    }

    if (this._tokens > 0) {
      this._tokens -= 1;
      return 0;
    }

    return this._period - (now - this._lastRefresh);
  }

  /**
   * Current bucket capacity.
   */
  get capacity(): number {
    return this._capacity;
  }
  /**
   * Changing `capacity` empties the bucket, which means you will have to wait
   * one period after setting it before being able to receiving any tokens.
   */
  setCapacity(value: number, now: number) {
    if (this._capacity === value) return;
    this._capacity = value;
    this._tokens = 0;
    this._lastRefresh = now;
  }

  /**
   * Current bucket refill period.
   */
  get period(): number {
    return this._period;
  }
  /**
   * Changing `period` empties the bucket, which means you will have to wait
   * one period after setting it before being able to receiving any tokens.
   */
  setPeriod(value: number, now: number) {
    if (this._period === value) return;
    this._period = value;
    this._tokens = 0;
    this._lastRefresh = now;
  }
}
