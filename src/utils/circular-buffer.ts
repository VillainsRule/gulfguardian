/**
 * Fixed-capacity ring buffer. O(1) push, O(1) indexed access.
 * Zero allocations after construction — avoids shift()/splice() GC churn.
 */
export class CircularBuffer<T> {
  private readonly items: T[];
  private head: number = 0;
  private _length: number = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.items = new Array<T>(capacity);
  }

  /** Number of elements currently stored */
  get length(): number {
    return this._length;
  }

  /** Push an item. If full, overwrites the oldest element. O(1). */
  push(item: T): void {
    const idx = (this.head + this._length) % this.capacity;
    this.items[idx] = item;
    if (this._length < this.capacity) {
      this._length++;
    } else {
      this.head = (this.head + 1) % this.capacity;
    }
  }

  /** Get element by logical index (0 = oldest, length-1 = newest). O(1). */
  get(index: number): T {
    return this.items[(this.head + index) % this.capacity];
  }

  /** Get the newest (most recently pushed) element. */
  newest(): T {
    return this.items[(this.head + this._length - 1) % this.capacity];
  }

  /** Get the oldest element. */
  oldest(): T {
    return this.items[this.head];
  }

  clear(): void {
    this.head = 0;
    this._length = 0;
  }

  /** Iterate from oldest to newest. */
  forEach(fn: (item: T, index: number) => void): void {
    for (let i = 0; i < this._length; i++) {
      fn(this.items[(this.head + i) % this.capacity], i);
    }
  }
}
