/**
 * Redis Store for Distributed Rate Limiting
 * Uses ioredis for Redis connectivity
 * @module @nis2shield/express-middleware
 */

import { RateLimiterStore } from '../types';

export interface RedisStoreOptions {
    /** Redis connection URL (e.g., redis://localhost:6379) */
    url?: string;
    /** Redis host (default: localhost) */
    host?: string;
    /** Redis port (default: 6379) */
    port?: number;
    /** Redis password */
    password?: string;
    /** Redis database number (default: 0) */
    db?: number;
    /** Key prefix for rate limit entries (default: 'nis2:rl:') */
    prefix?: string;
    /** Existing Redis client instance (ioredis) */
    client?: any;
}

/**
 * RedisStore provides distributed rate limiting using Redis.
 * 
 * Prerequisites:
 * - Install ioredis: `npm install ioredis`
 * 
 * @example
 * ```typescript
 * import { RedisStore } from '@nis2shield/express-middleware';
 * 
 * const store = new RedisStore({ url: 'redis://localhost:6379' });
 * 
 * app.use(nis2Shield({
 *   activeDefense: {
 *     rateLimit: {
 *       enabled: true,
 *       store: store,
 *     }
 *   }
 * }));
 * ```
 */
export class RedisStore implements RateLimiterStore {
    private client: any = null;
    private prefix: string;
    private windowMs: number = 60000;
    private options: RedisStoreOptions;
    private initialized: boolean = false;
    private initPromise: Promise<void> | null = null;

    constructor(options: RedisStoreOptions = {}) {
        this.options = options;
        this.prefix = options.prefix || 'nis2:rl:';
    }

    /**
     * Set the rate limit window (called by middleware)
     */
    setWindowMs(windowMs: number): void {
        this.windowMs = windowMs;
    }

    /**
     * Initialize the Redis connection
     */
    private async init(): Promise<void> {
        if (this.initialized) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                if (this.options.client) {
                    // Use provided client
                    this.client = this.options.client;
                } else {
                    // Create new client using ioredis
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const Redis = require('ioredis');

                    if (this.options.url) {
                        this.client = new Redis(this.options.url);
                    } else {
                        this.client = new Redis({
                            host: this.options.host || 'localhost',
                            port: this.options.port || 6379,
                            password: this.options.password,
                            db: this.options.db || 0,
                        });
                    }
                }

                // Test connection
                await this.client.ping();
                this.initialized = true;
                console.log('[NIS2 Shield] Redis store connected');
            } catch (error: any) {
                if (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND') {
                    console.error('[NIS2 Shield] ioredis not installed. Run: npm install ioredis');
                } else {
                    console.error('[NIS2 Shield] Redis connection failed:', error.message);
                }
                throw error;
            }
        })();

        return this.initPromise;
    }

    /**
     * Increment hit count for a key
     */
    async increment(key: string): Promise<{ count: number; resetTime: number }> {
        await this.init();

        const redisKey = this.prefix + key;
        const now = Date.now();

        // Use MULTI/EXEC for atomic operation
        const results = await this.client.multi()
            .incr(redisKey)
            .pttl(redisKey)
            .exec();

        const count = results[0][1] as number;
        let pttl = results[1][1] as number;

        // Set TTL if this is a new key
        if (pttl === -1) {
            await this.client.pexpire(redisKey, this.windowMs);
            pttl = this.windowMs;
        }

        const resetTime = now + (pttl > 0 ? pttl : this.windowMs);

        return { count, resetTime };
    }

    /**
     * Decrement hit count for a key
     */
    async decrement(key: string): Promise<void> {
        if (!this.initialized) return;

        const redisKey = this.prefix + key;
        await this.client.decr(redisKey);
    }

    /**
     * Reset (delete) a key
     */
    async reset(key: string): Promise<void> {
        if (!this.initialized) return;

        const redisKey = this.prefix + key;
        await this.client.del(redisKey);
    }

    /**
     * Close the Redis connection
     */
    async close(): Promise<void> {
        if (this.client && !this.options.client) {
            await this.client.quit();
            this.initialized = false;
            this.initPromise = null;
        }
    }

    /**
     * Check if store is connected
     */
    isConnected(): boolean {
        return this.initialized && this.client?.status === 'ready';
    }
}
