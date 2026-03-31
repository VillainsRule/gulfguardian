export function hashString(value: string): number {
  const text = String(value ?? '');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRNG {
  private seed: string;
  private index: number = 0;

  constructor(seed: string) {
    this.seed = seed;
  }

  next(): number {
    const hashed = hashString(`${this.seed}:${this.index}`);
    this.index++;
    return hashed / 4294967296;
  }

  nextRange(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }

  reset(): void {
    this.index = 0;
  }

  getSeed(): string {
    return this.seed;
  }

  getIndex(): number {
    return this.index;
  }
}
