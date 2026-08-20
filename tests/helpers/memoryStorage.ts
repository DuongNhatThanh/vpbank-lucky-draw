import type { StorageLike } from "../../src/services/persistence";

export class MemoryStorage implements StorageLike {
  private readonly data = new Map<string, string>();

  constructor(private readonly throwOn: Partial<Record<"getItem" | "setItem" | "removeItem", Error>> = {}) {}

  getItem(key: string): string | null {
    if (this.throwOn.getItem) {
      throw this.throwOn.getItem;
    }

    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOn.setItem) {
      throw this.throwOn.setItem;
    }

    this.data.set(key, value);
  }

  removeItem(key: string): void {
    if (this.throwOn.removeItem) {
      throw this.throwOn.removeItem;
    }

    this.data.delete(key);
  }

  peek(key: string): string | null {
    return this.data.get(key) ?? null;
  }
}
