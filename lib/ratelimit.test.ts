import * as testing from "https://deno.land/std@0.170.0/testing/asserts.ts";
import { Bucket, JoinLimiter, PrivmsgLimiter, AccountStatus, ChannelRole } from "./ratelimit.ts";
import { type Channel } from "./base.ts";

Deno.test("Bucket 1 token every 1s", () => {
  const bucket = new Bucket({ capacity: 1, period: 1000 });

  testing.assertEquals(bucket.get(0), 0);
  testing.assertEquals(bucket.get(1), 999);
  testing.assertEquals(bucket.get(1000), 0);
  testing.assertEquals(bucket.get(1005), 995);
  testing.assertEquals(bucket.get(2000), 0);
  testing.assertEquals(bucket.get(2011), 989);
  testing.assertEquals(bucket.get(3000), 0);
});

Deno.test("Bucket 20 tokens every 30s", () => {
  const bucket = new Bucket({ capacity: 20, period: 30 * 1000 });

  for (let i = 0; i < 20; ++i) {
    testing.assertEquals(bucket.get(0), 0);
  }
  testing.assertEquals(bucket.get(0), 30 * 1000);

  for (let i = 0; i < 20; ++i) {
    testing.assertEquals(bucket.get(30 * 1000), 0);
  }
  testing.assertEquals(bucket.get(30 * 1000), 30 * 1000);
});

Deno.test("Bucket reset when changing period/capacity", () => {
  const bucket = new Bucket({ capacity: 20, period: 30 * 1000 });

  for (let i = 0; i < 10; ++i) {
    testing.assertEquals(bucket.get(0), 0);
  }
  bucket.setCapacity(30, 0);
  testing.assertEquals(bucket.get(0), 30 * 1000);
  for (let i = 0; i < 30; ++i) {
    testing.assertEquals(bucket.get(30 * 1000), 0);
  }
});

Deno.test("Join limiter (normal)", () => {
  const limiter = new JoinLimiter({ status: AccountStatus.Normal });

  // 20 tokens every 10s
  for (let i = 0; i < 20; ++i) {
    testing.assertEquals(limiter.get(0), 0);
  }
  testing.assertEquals(limiter.get(0), 10 * 1000);

  for (let i = 0; i < 20; ++i) {
    testing.assertEquals(limiter.get(10 * 1000), 0);
  }
  testing.assertEquals(limiter.get(10 * 1000), 10 * 1000);
});

Deno.test("Join limiter (verified)", () => {
  const limiter = new JoinLimiter({ status: AccountStatus.Verified });

  // 2000 tokens every 10s
  for (let i = 0; i < 2000; ++i) {
    testing.assertEquals(limiter.get(0), 0);
  }
  testing.assertEquals(limiter.get(0), 10 * 1000);

  for (let i = 0; i < 2000; ++i) {
    testing.assertEquals(limiter.get(10 * 1000), 0);
  }
  testing.assertEquals(limiter.get(10 * 1000), 10 * 1000);
});

Deno.test("Privmsg limiter (normal viewer)", () => {
  const limiter = new PrivmsgLimiter({ status: AccountStatus.Normal });
  const channel = "#test";
  const role = ChannelRole.Viewer;

  // 1 token every 1s + 20 tokens every 30s
  for (let i = 0; i < 20; ++i) {
    testing.assertEquals(limiter.get(i * 1.0 * 1000, channel, { role }), 0);
  }
  testing.assertEquals(limiter.get(20 * 1.0 * 1000, channel, { role }), 10 * 1000);
});

Deno.test("Privmsg limiter (normal moderator)", () => {
  const limiter = new PrivmsgLimiter({ status: AccountStatus.Normal });
  const channel = "#test";
  const role = ChannelRole.Moderator;

  // 20 tokens every 30s
  // role >= VIP -> not affected by slowmode
  for (let i = 0; i < 20; ++i) {
    testing.assertEquals(limiter.get(0, channel, { role }), 0);
  }
  testing.assertEquals(limiter.get(0, channel, { role }), 30 * 1000);
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
    // (per-channel) 1 token every 1s + 20 tokens every 30s
    testing.assertEquals(limiter.get(0, channel, { role }), 0);
    tokens -= 1;
    for (let i = 1; i < 20; ++i) {
      testing.assertEquals(limiter.get(i * 1.0 * 1000 - 500, channel, { role }), 500);
      testing.assertEquals(limiter.get(i * 1.0 * 1000, channel, { role }), 0);
      tokens -= 1;
    }
    testing.assertEquals(limiter.get(20 * 1.0 * 1000, channel, { role }), 10 * 1000);
    // @ts-expect-error: accesing private property in test
    const globalRemaining = limiter._global._tokens;
    testing.assertEquals(globalRemaining, tokens);
  }
});

Deno.test("Privmsg limiter (verified moderator) global limit", () => {
  const limiter = new PrivmsgLimiter({ status: AccountStatus.Verified });
  const channels = Array(7500 / 20)
    .fill(0)
    .map((_, i) => `#${i}`) as Channel[];
  const role = ChannelRole.Moderator;

  // (global) 7500 tokens every 30s
  let tokens = 7500;
  for (const channel of channels) {
    // (per-channel) 20 tokens every 30s
    // role >= VIP -> not affected by slowmode
    for (let i = 0; i < 20; ++i) {
      testing.assertEquals(limiter.get(0, channel, { role }), 0);
      tokens -= 1;
    }
    testing.assertEquals(limiter.get(0, channel, { role }), 30 * 1000);
    // @ts-expect-error: accesing private property in test
    const globalRemaining = limiter._global._tokens;
    testing.assertEquals(globalRemaining, tokens);
  }
});

