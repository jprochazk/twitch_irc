import * as testing from "https://deno.land/std@0.143.0/testing/asserts.ts";
import { PrivmsgQueue } from "./queue.ts";
import { type RateLimiter } from "./ratelimit.ts";
import { type RawMessage } from "./base.ts";

class Setup {
  delay = 0;
  rateLimiter: RateLimiter = {
    privmsg: () => {
      return this.delay;
    },
    join: () => {
      return this.delay;
    },
  };

  sent: RawMessage[] = [];
  sender = (msg: RawMessage) => this.sent.push(msg);

  // deno-lint-ignore no-explicit-any
  timeouts: { fn: (...args: any[]) => void; delay: number; args: any[] }[] = [];
  timer = {
    // deno-lint-ignore no-explicit-any
    set: (fn: (...args: any[]) => void, delay: number, ...args: any[]): number => {
      return this.timeouts.push({ fn, delay, args }) - 1;
    },
    clear: (id: number) => {
      this.timeouts.splice(id, 1);
    },
    dispatch: () => {
      const timeout = this.timeouts.shift();
      if (timeout) {
        const { fn, args } = timeout;
        fn(args);
      }
    },
  };

  getSocketState = () => {
    return WebSocket.OPEN;
  };
}

Deno.test("PrivmsgQueue dispatch immediate", () => {
  const setup = new Setup();

  const channel = "#test";
  const queue = new PrivmsgQueue(setup.sender, setup.rateLimiter, setup.getSocketState);
  // @ts-expect-error: accesing private property in test
  queue._timer.set = setup.timer.set;
  // @ts-expect-error: accesing private property in test
  queue._timer.clear = setup.timer.clear;

  queue.open(channel);
  queue.send("test\r\n", channel);

  // @ts-expect-error: accesing private property in test
  testing.assertEquals(queue._channels[channel].queue._tail, 0);
  // @ts-expect-error: accesing private property in test
  testing.assertEquals(queue._channels[channel].queue._head, 1);
  testing.assertEquals(setup.sent.length, 0);
  testing.assertEquals(setup.timeouts.length, 1);

  setup.timer.dispatch();
  // @ts-expect-error: accesing private property in test
  testing.assertEquals(queue._channels[channel].queue._tail, 1);
  // @ts-expect-error: accesing private property in test
  testing.assertEquals(queue._channels[channel].queue._head, 1);
  testing.assertEquals(setup.sent.length, 1);
  testing.assertEquals(setup.timeouts.length, 1);
});

Deno.test("PrivmsgQueue dispatch delayed", () => {
  const setup = new Setup();

  const channel = "#test";
  const message = "test\r\n";
  const queue = new PrivmsgQueue(setup.sender, setup.rateLimiter, setup.getSocketState);
  // @ts-expect-error: accesing private property in test
  queue._timer.set = setup.timer.set;
  // @ts-expect-error: accesing private property in test
  queue._timer.clear = setup.timer.clear;

  queue.open(channel);
  queue.send(message, channel);

  // @ts-expect-error: accesing private property in test
  testing.assertEquals(queue._channels[channel].queue._tail, 0);
  // @ts-expect-error: accesing private property in test
  testing.assertEquals(queue._channels[channel].queue._head, 1);
  testing.assertEquals(setup.sent.length, 0);
  testing.assertEquals(setup.timeouts.length, 1);

  setup.delay = 100;
  setup.timer.dispatch();
  testing.assertEquals(setup.timeouts[0].delay, 100);
  // @ts-expect-error: accesing private property in test
  testing.assertEquals(queue._channels[channel].queue._tail, 0);
  // @ts-expect-error: accesing private property in test
  testing.assertEquals(queue._channels[channel].queue._head, 1);
  testing.assertEquals(setup.sent.length, 0);
  testing.assertEquals(setup.timeouts.length, 1);

  setup.delay = 0;
  setup.timer.dispatch();
  testing.assertEquals(setup.timeouts[0].delay, 0);
  // @ts-expect-error: accesing private property in test
  testing.assertEquals(queue._channels[channel].queue._tail, 1);
  // @ts-expect-error: accesing private property in test
  testing.assertEquals(queue._channels[channel].queue._head, 1);
  testing.assertEquals(setup.sent, [message]);
  testing.assertEquals(setup.timeouts.length, 1);
});
