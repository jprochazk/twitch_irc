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

/**
 * Splits `str` by `delimiter`
 *
 * If `delimiter.length > 1`, the right side will contain everything past the first character of the delimiter.
 * For example:
 * ```ts
 * const [a, b] = splitOnce("test :test", " :");
 * assert(a === "test");
 * assert(b === ":test");
 * ```
 */
export function splitOnce(str: string, delimiter: string): [string, string | null] {
  const index = str.indexOf(delimiter);
  if (index === -1) return [str, null];
  else return [str.slice(0, index), str.slice(index + 1)];
}

/**
 * Converts a string from `kebab-case` into `lowerCamelCase`.
 *
 * E.g. `reply-parent-display-name` is converted to `replyParentDisplayName`.
 */
export function kebabToCamelCase(str: string): string {
  const parts = str.split("-");
  if (parts.length > 1) {
    parts[0] = parts[0].toLowerCase();
    for (let i = 1; i < parts.length; ++i) {
      parts[i] = parts[i].slice(0, 1).toUpperCase() + parts[i].slice(1).toLowerCase();
    }
  }
  return parts.join("");
}

export type KebabToCamelCase<K extends string> = K extends `${infer Left}-${infer Right}`
  ? `${Lowercase<Left>}${Capitalize<KebabToCamelCase<Right>>}`
  : `${Lowercase<K>}`;
