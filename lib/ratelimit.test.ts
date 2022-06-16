import { assertEquals } from "https://deno.land/std@0.143.0/testing/asserts.ts";
import {
  Bucket,
  JoinLimiter,
  PrivmsgLimiter,
  SlowModeLimiter,
  AccountStatus,
  ChannelRole,
} from "./ratelimit.ts";
import { type Channel } from "./base.ts";

Deno.test("Bucket 1 token every 1s", () => {
  const bucket = new Bucket({ capacity: 1, period: 1000 });

  assertEquals(bucket.get(0), 0);
  assertEquals(bucket.get(1), 999);
  assertEquals(bucket.get(1000), 0);
  assertEquals(bucket.get(1005), 995);
  assertEquals(bucket.get(2000), 0);
  assertEquals(bucket.get(2011), 989);
  assertEquals(bucket.get(3000), 0);
});

Deno.test("Bucket 20 tokens every 30s", () => {
  const bucket = new Bucket({ capacity: 20, period: 30 * 1000 });

  for (let i = 0; i < 20; ++i) {
    assertEquals(bucket.get(0), 0);
  }
  assertEquals(bucket.get(0), 30 * 1000);

  for (let i = 0; i < 20; ++i) {
    assertEquals(bucket.get(30 * 1000), 0);
  }
  assertEquals(bucket.get(30 * 1000), 30 * 1000);
});

Deno.test("Bucket reset when changing period/capacity", () => {
  const bucket = new Bucket({ capacity: 20, period: 30 * 1000 });

  for (let i = 0; i < 10; ++i) {
    assertEquals(bucket.get(0), 0);
  }
  bucket.setCapacity(30, 0);
  assertEquals(bucket.get(0), 30 * 1000);
  for (let i = 0; i < 30; ++i) {
    assertEquals(bucket.get(30 * 1000), 0);
  }
});

Deno.test("Join limiter (normal)", () => {
  const limiter = new JoinLimiter({ status: AccountStatus.Normal });

  // 20 tokens every 10s
  for (let i = 0; i < 20; ++i) {
    assertEquals(limiter.get(0), 0);
  }
  assertEquals(limiter.get(0), 10 * 1000);

  for (let i = 0; i < 20; ++i) {
    assertEquals(limiter.get(10 * 1000), 0);
  }
  assertEquals(limiter.get(10 * 1000), 10 * 1000);
});

Deno.test("Join limiter (verified)", () => {
  const limiter = new JoinLimiter({ status: AccountStatus.Verified });

  // 2000 tokens every 10s
  for (let i = 0; i < 2000; ++i) {
    assertEquals(limiter.get(0), 0);
  }
  assertEquals(limiter.get(0), 10 * 1000);

  for (let i = 0; i < 2000; ++i) {
    assertEquals(limiter.get(10 * 1000), 0);
  }
  assertEquals(limiter.get(10 * 1000), 10 * 1000);
});

Deno.test("Slow mode limiter (viewer) 1s -> 10s", () => {
  const limiter = new SlowModeLimiter();
  const channel = "#test";

  // 1 token every 1s
  assertEquals(limiter.get(0, channel), 0);
  assertEquals(limiter.get(0, channel), 1000);
  assertEquals(limiter.get(999, channel), 1);

  // changed to 1 token every 10s
  // changing period/capacity empties the bucket
  const options = { slowModeSeconds: 10 };
  assertEquals(limiter.get(1 * 1000, channel, options), 10 * 1000);
  assertEquals(limiter.get(10 * 1000, channel, options), 1 * 1000);
  assertEquals(limiter.get(11 * 1000, channel, options), 0);
  assertEquals(limiter.get(11 * 1000, channel, options), 10 * 1000);
  assertEquals(limiter.get(20 * 1000, channel, options), 1 * 1000);
  assertEquals(limiter.get(21 * 1000, channel, options), 0);
});

Deno.test("Slow mode limiter (moderator) 1s -> 10s", () => {
  const limiter = new SlowModeLimiter();
  const channel = "#test";

  // 1 token every 1s
  assertEquals(limiter.get(0, channel), 0);
  assertEquals(limiter.get(0, channel), 1000);
  assertEquals(limiter.get(999, channel), 1);

  // changed to 1 token every 10s
  // changing period/capacity empties the bucket
  // because slow mode has no effect on moderators, it will not be changed
  // and thus it will not empty the bucket
  const options = { slowModeSeconds: 10, role: ChannelRole.Moderator };
  assertEquals(limiter.get(1 * 1000, channel, options), 0);
  assertEquals(limiter.get(1 * 1000, channel, options), 1 * 1000);
  assertEquals(limiter.get(2 * 1000, channel, options), 0);
  assertEquals(limiter.get(2 * 1000, channel, options), 1 * 1000);
  assertEquals(limiter.get(3 * 1000, channel, options), 0);
});

Deno.test("Privmsg limiter (normal viewer)", () => {
  const limiter = new PrivmsgLimiter({ status: AccountStatus.Normal });
  const channel = "#test";
  const role = ChannelRole.Viewer;

  // 20 tokens every 30s
  for (let i = 0; i < 20; ++i) {
    assertEquals(limiter.get(0, channel, { role }), 0);
  }
  assertEquals(limiter.get(0, channel, { role }), 30 * 1000);
});

Deno.test("Privmsg limiter (normal moderator)", () => {
  const limiter = new PrivmsgLimiter({ status: AccountStatus.Normal });
  const channel = "#test";
  const role = ChannelRole.Moderator;

  // 100 tokens every 30s
  for (let i = 0; i < 100; ++i) {
    assertEquals(limiter.get(0, channel, { role }), 0);
  }
  assertEquals(limiter.get(0, channel, { role }), 30 * 1000);
});

Deno.test("Privmsg limiter (verified viewer) global limit", () => {
  const limiter = new PrivmsgLimiter({ status: AccountStatus.Verified });
  const channels = Array(7500 / 20)
    .fill(0)
    .map((_, i) => `#${i}`) as Channel[];
  const role = ChannelRole.Viewer;

  // (global) 7500 tokens every 30s
  let tokens = 7500;
  for (const channel of channels) {
    // (per-channel) 20 tokens every 30s
    for (let i = 0; i < 20; ++i) {
      assertEquals(limiter.get(0, channel, { role }), 0);
      tokens -= 1;
    }
    assertEquals(limiter.get(0, channel, { role }), 30 * 1000);
    // @ts-expect-error: accesing private property in test
    const globalRemaining = limiter._global._tokens;
    assertEquals(globalRemaining, tokens);
  }
});

Deno.test("Privmsg limiter (verified moderator) global limit", () => {
  const limiter = new PrivmsgLimiter({ status: AccountStatus.Verified });
  const channels = Array(7500 / 100)
    .fill(0)
    .map((_, i) => `#${i}`) as Channel[];
  const role = ChannelRole.Moderator;

  // (global) 7500 tokens every 30s
  let tokens = 7500;
  for (const channel of channels) {
    // (per-channel) 100 tokens every 30s
    for (let i = 0; i < 100; ++i) {
      assertEquals(limiter.get(0, channel, { role }), 0);
      tokens -= 1;
    }
    assertEquals(limiter.get(0, channel, { role }), 30 * 1000);
    // @ts-expect-error: accesing private property in test
    const globalRemaining = limiter._global._tokens;
    assertEquals(globalRemaining, tokens);
  }
});
