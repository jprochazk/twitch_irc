import { type Channel } from "./client.ts";
import { sleep } from "./util.ts";

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
  private _slowmode: SlowModeLimiter;
  private _join: JoinLimiter;
  private _sleep: (ms: number) => Promise<void> = sleep;

  constructor(options: { status?: AccountStatus } = {}) {
    this._privmsg = new PrivmsgLimiter(options);
    this._slowmode = new SlowModeLimiter();
    this._join = new JoinLimiter(options);
  }

  privmsg(
    now: number,
    channel: Channel,
    options: { role?: ChannelRole; slowModeSeconds?: number } = {}
  ): number {
    // check per-channel + global limit first
    const privmsg = this._privmsg.get(now, channel, options);
    if (privmsg > 0) {
      return privmsg;
    }

    // then check slowmode
    const slowmode = this._slowmode.get(now, channel, options);
    if (slowmode > 0) {
      return slowmode;
    }

    return 0;
  }

  join(now: number): number {
    return this._join.get(now);
  }
}

/**
 * Privmsg limiter, handling per-channel message limits based on vip/mod/streamer role,
 * and global limit for verified bots.
 *
 * You should use `DefaultLimiter` unless you have a good reason not to.
 */
export class PrivmsgLimiter {
  private _buckets: Record<Channel, Bucket> = {};
  private _global?: Bucket;

  constructor(options: { status?: AccountStatus } = {}) {
    if (options.status === AccountStatus.Verified) {
      this._global = new Bucket({ capacity: 7500, period: 30 * SECOND });
    }
  }

  /**
   * Returns the remaining number of milliseconds until a token is available.
   */
  get(now: number, channel: Channel, options: { role?: ChannelRole } = {}): number {
    const role = options.role ?? ChannelRole.Viewer;
    const capacity = role >= ChannelRole.VIP ? 100 : 20;

    this._buckets[channel] ??= new Bucket({ capacity, period: 30 * SECOND });
    if (this._buckets[channel].capacity !== capacity) {
      this._buckets[channel].setCapacity(capacity, now);
    }

    const perChannel = this._buckets[channel].get(now);
    if (perChannel > 0) {
      return perChannel;
    }

    if (this._global) {
      return this._global?.get(now);
    }

    return 0;
  }
}

/**
 * Slow mode limiter, handling per-channel slow mode, which defaults to 1s,
 * with correct treatment of vip/mod/streamer roles.
 *
 * You should use `DefaultLimiter` unless you have a good reason not to.
 */
export class SlowModeLimiter {
  private _buckets: Record<Channel, Bucket> = {};

  /**
   * Returns the remaining number of milliseconds until a token is available.
   */
  get(
    now: number,
    channel: Channel,
    options: { slowModeSeconds?: number; role?: ChannelRole } = {}
  ) {
    const role = options.role ?? ChannelRole.Viewer;
    const ms = role >= ChannelRole.VIP ? 1 * SECOND : (options?.slowModeSeconds ?? 1) * SECOND;

    this._buckets[channel] ??= new Bucket({ capacity: 1, period: ms });
    if (this._buckets[channel].period !== ms) {
      this._buckets[channel].setPeriod(ms, now);
    }

    return this._buckets[channel].get(now);
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
    this._period = value;
    this._tokens = 0;
    this._lastRefresh = now;
  }
}
