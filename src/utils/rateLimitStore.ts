/**
 * In-Memory Rate Limit Store
 * @module @nis2shield/express-middleware
 */

import { RateLimiterStore } from '../types';

interface HitRecord {
  count: number;
  resetTime: number;
}

export class MemoryStore implements RateLimiterStore {
  private hits: Map<string, HitRecord> = new Map();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;

    // Cleanup interval to prevent memory leaks
    setInterval(() => this.cleanup(), 60000).unref();
  }

  async increment(key: string): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const record = this.hits.get(key);

    if (!record || record.resetTime <= now) {
      // New window or expired
      const newRecord = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      this.hits.set(key, newRecord);
      return newRecord;
    }

    // Increment existing
    record.count++;
    return record;
  }

  async decrement(key: string): Promise<void> {
    const record = this.hits.get(key);
    if (record && record.count > 0) {
      record.count--;
    }
  }

  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.hits.entries()) {
      if (record.resetTime <= now) {
        this.hits.delete(key);
      }
    }
  }
}
