export interface TunableVar {
  key: string;
  label: string;
  category: string;
  min: number;
  max: number;
  step: number;
  get: () => number;
  set: (v: number) => void;
  default: number;
}

const registry: Map<string, TunableVar> = new Map();

export function registerVar(v: TunableVar): void {
  registry.set(v.key, v);
}

export function getVar(key: string): TunableVar | undefined {
  return registry.get(key);
}

export function getAllVars(): TunableVar[] {
  return Array.from(registry.values());
}

export function getCategories(): string[] {
  const cats = new Set<string>();
  for (const v of registry.values()) cats.add(v.category);
  return Array.from(cats);
}

export function getVarsByCategory(category: string): TunableVar[] {
  return getAllVars().filter(v => v.category === category);
}

export function resetAll(): void {
  for (const v of registry.values()) {
    v.set(v.default);
  }
}

export function exportJSON(): string {
  const obj: Record<string, number> = {};
  for (const v of registry.values()) {
    obj[v.key] = v.get();
  }
  return JSON.stringify(obj, null, 2);
}

export function importJSON(json: string): void {
  const obj = JSON.parse(json) as Record<string, number>;
  for (const [key, val] of Object.entries(obj)) {
    const v = registry.get(key);
    if (v && typeof val === 'number') {
      v.set(Math.max(v.min, Math.min(v.max, val)));
    }
  }
}

export function exportSnapshot(): Record<string, number> {
  const obj: Record<string, number> = {};
  for (const v of registry.values()) {
    obj[v.key] = v.get();
  }
  return obj;
}

/** @internal Clear registry — for testing only */
export function _clearForTesting(): void {
  registry.clear();
}
