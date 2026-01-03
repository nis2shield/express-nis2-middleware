/**
 * Tor Exit Node Detector
 * Fetches and caches real Tor exit node list from TorProject
 * @module @nis2shield/express-middleware
 */

const TOR_EXIT_LIST_URL = 'https://check.torproject.org/torbulkexitlist';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface TorCache {
  exitNodes: Set<string>;
  lastUpdated: number;
  loading: boolean;
}

// Global cache for Tor exit nodes
const cache: TorCache = {
  exitNodes: new Set(),
  lastUpdated: 0,
  loading: false,
};

// Test IP for development/testing (always treated as Tor)
const TEST_TOR_IP = '6.6.6.6';

/**
 * TorDetector provides methods to check if an IP is a known Tor exit node.
 * It fetches the list from TorProject and caches it for 6 hours.
 *
 * @example
 * ```typescript
 * import { TorDetector } from './torDetector';
 *
 * const detector = new TorDetector();
 * const isTor = await detector.isTorExitNode('1.2.3.4');
 * ```
 */
export class TorDetector {
  constructor(_options?: { enableCache?: boolean }) {
    // Cache is always enabled by default
  }

  /**
   * Check if an IP address is a known Tor exit node
   */
  async isTorExitNode(ip: string): Promise<boolean> {
    // Test IP for development
    if (ip === TEST_TOR_IP) {
      return true;
    }

    // Try to get from cache or fetch
    await this.ensureCacheLoaded();
    return cache.exitNodes.has(ip);
  }

  /**
   * Synchronous check using cached data only (non-blocking)
   * Returns false if cache is not loaded yet
   */
  isTorExitNodeSync(ip: string): boolean {
    // Test IP for development
    if (ip === TEST_TOR_IP) {
      return true;
    }

    // Check against cached data
    return cache.exitNodes.has(ip);
  }

  /**
   * Ensure the cache is loaded, fetching if needed
   */
  private async ensureCacheLoaded(): Promise<void> {
    const now = Date.now();
    const cacheAge = now - cache.lastUpdated;

    // Cache is fresh
    if (cacheAge < CACHE_TTL_MS && cache.exitNodes.size > 0) {
      return;
    }

    // Already loading
    if (cache.loading) {
      return;
    }

    // Fetch new data
    await this.fetchTorExitNodes();
  }

  /**
   * Fetch Tor exit nodes from TorProject
   */
  private async fetchTorExitNodes(): Promise<void> {
    if (cache.loading) return;
    cache.loading = true;

    try {
      const response = await fetch(TOR_EXIT_LIST_URL, {
        headers: {
          'User-Agent': 'NIS2Shield-Express-Middleware/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = await response.text();
      const ips = this.parseExitList(text);

      // Update cache
      cache.exitNodes = new Set(ips);
      cache.lastUpdated = Date.now();

      console.log(`[NIS2 Shield] Loaded ${cache.exitNodes.size} Tor exit nodes`);
    } catch (error) {
      console.error('[NIS2 Shield] Failed to fetch Tor exit nodes:', error);
      // Keep using old cache if available, or empty set
      if (cache.exitNodes.size === 0) {
        console.warn('[NIS2 Shield] Tor blocking will use test IP only (6.6.6.6)');
      }
    } finally {
      cache.loading = false;
    }
  }

  /**
   * Parse the bulk exit list text format
   */
  private parseExitList(text: string): string[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => {
        // Skip comments and empty lines
        if (!line || line.startsWith('#')) return false;
        // Basic IP validation
        return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(line);
      });
  }

  /**
   * Force refresh the cache
   */
  async refresh(): Promise<void> {
    cache.lastUpdated = 0;
    await this.fetchTorExitNodes();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; lastUpdated: Date | null; ageMs: number } {
    return {
      size: cache.exitNodes.size,
      lastUpdated: cache.lastUpdated ? new Date(cache.lastUpdated) : null,
      ageMs: cache.lastUpdated ? Date.now() - cache.lastUpdated : 0,
    };
  }
}

// Singleton instance
let defaultDetector: TorDetector | null = null;

/**
 * Get the default TorDetector instance
 */
export function getTorDetector(): TorDetector {
  if (!defaultDetector) {
    defaultDetector = new TorDetector();
  }
  return defaultDetector;
}

/**
 * Pre-warm the Tor cache (call on app startup for best performance)
 */
export async function warmTorCache(): Promise<void> {
  const detector = getTorDetector();
  await detector.refresh();
}
