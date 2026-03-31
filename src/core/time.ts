export class TimeManager {
  private elapsed: number = 0;
  private deltaTime: number = 0;

  update(dt: number): void {
    this.deltaTime = dt;
    this.elapsed += dt;
  }

  getElapsed(): number {
    return this.elapsed;
  }

  getDeltaTime(): number {
    return this.deltaTime;
  }

  reset(): void {
    this.elapsed = 0;
    this.deltaTime = 0;
  }
}

type EventCallback = (...args: any[]) => void;

class EventBus {
  private listeners: Map<string, EventCallback[]> = new Map();

  on(event: string, cb: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(cb);
  }

  off(event: string, cb: EventCallback): void {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(cb);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  emit(event: string, ...args: any[]): void {
    const list = this.listeners.get(event);
    if (list) list.forEach((cb) => cb(...args));
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const events = new EventBus();
