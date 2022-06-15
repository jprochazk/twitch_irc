export const nonce = (length = 32) =>
  [...crypto.getRandomValues(new Uint8Array(length / 2))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");

export const sleep = (delay: number) => new Promise<void>((done) => setTimeout(done, delay));

export function noop() {}
