import * as testing from "https://deno.land/std@0.170.0/testing/asserts.ts";
import { GrowableRingBuffer } from "./ringbuffer.ts";

Deno.test("GrowableRingBuffer simple get/put", () => {
  const buffer = new GrowableRingBuffer<number>(20);

  for (let i = 0; i < 10; ++i) {
    buffer.put(i);
  }

  for (let i = 0; i < 10; ++i) {
    testing.assertEquals(buffer.get(), i);
  }
});

Deno.test("GrowableRingBuffer get wrapping", () => {
  const buffer = new GrowableRingBuffer<number>(4);

  for (let i = 0; i < 4; ++i) {
    buffer.put(i);
  }
  //   t==h
  // [ 0, 1, 2, 3 ]
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer, [0, 1, 2, 3]);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._tail, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._head, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer.length, 4);

  testing.assertEquals(buffer.get(), 0);
  testing.assertEquals(buffer.get(), 1);
  //   h     t
  // [ n, n, 2, 3 ]
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer, [null, null, 2, 3]);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._tail, 2);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._head, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer.length, 4);

  for (let i = 4; i < 6; ++i) {
    buffer.put(i);
  }
  //         t==h
  // [ 4, 5, 2, 3 ]
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer, [4, 5, 2, 3]);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._tail, 2);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._head, 2);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer.length, 4);

  testing.assertEquals(buffer.get(), 2);
  testing.assertEquals(buffer.get(), 3);
  //   t     h
  // [ 4, 5, n, n ]
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer, [4, 5, null, null]);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._tail, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._head, 2);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer.length, 4);

  for (let i = 6; i < 8; ++i) {
    buffer.put(i);
  }
  //   t==h
  // [ 4, 5, 6, 7 ]
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer, [4, 5, 6, 7]);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._tail, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._head, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer.length, 4);

  testing.assertEquals(buffer.get(), 4);
  testing.assertEquals(buffer.get(), 5);
  //   h     t
  // [ n, n, 6, 7 ]
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer, [null, null, 6, 7]);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._tail, 2);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._head, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer.length, 4);
});

Deno.test("GrowableRingBuffer put grow", () => {
  const buffer = new GrowableRingBuffer(1);

  buffer.put(0);
  //   t==h
  // [ 0 ] cap=1
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer, [0]);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._tail, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._head, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer.length, 1);

  buffer.put(1);
  //   t==h
  // [ 0, 1 ] cap=2
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer, [0, 1]);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._tail, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._head, 0);
  // @ts-expect-error: accessing private property in test
  testing.assertEquals(buffer._buffer.length, 2);
});

