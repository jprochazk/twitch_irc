export const nonce = (length = 32) =>
  [...crypto.getRandomValues(new Uint8Array(length / 2))]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");

export const sleep = (delay: number) => new Promise<void>((done) => setTimeout(done, delay));

export function noop() {}

export const never = <T = void>() => new Promise<T>(noop);

export class Queue<T> {
  private _put: T[] = [];
  private _get: T[] = [];

  put(v: T) {
    this._put.push(v);
  }

  get(): T | undefined {
    if (this._get.length === 0) {
      const temp = this._put;
      this._put = this._get;
      this._get = temp;
    }
    return this._get.shift();
  }

  isEmpty(): boolean {
    return this._get.length === 0 && this._put.length === 0;
  }
}
