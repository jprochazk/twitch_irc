const GROWTH_FACTOR = 2;

export class GrowableRingBuffer<T> {
  private _buffer: Array<T | null>;
  private _tail = 0;
  private _head = 0;

  constructor(initialCapacity: number) {
    this._buffer = new Array(initialCapacity).fill(null);
  }

  put(item: T) {
    if (this._buffer[this._head] !== null) {
      // remaining capacity == 0, grow
      this._grow();
    }

    // remaining capacity > 0, insert
    this._buffer[this._head] = item;
    this._head = (this._head + 1) % this._buffer.length;
  }

  peek(): T | null {
    return this._buffer[this._tail];
  }

  get(): T | null {
    const item = this._buffer[this._tail];
    if (item !== null) {
      this._buffer[this._tail] = null;
      this._tail = (this._tail + 1) % this._buffer.length;
    }

    return item;
  }

  private _grow() {
    const newBuffer = new Array<T | null>(this._buffer.length * GROWTH_FACTOR).fill(null);
    let head = 0;
    let item = this._buffer[this._tail];
    while (item !== null) {
      newBuffer[head] = item;
      head += 1;
      this._buffer[this._tail] = null;
      this._tail = (this._tail + 1) % this._buffer.length;
      item = this._buffer[this._tail];
    }

    this._buffer = newBuffer;
    this._tail = 0;
    this._head = head;
  }
}
