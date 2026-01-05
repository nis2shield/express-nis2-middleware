/**
 * GeoIP Service for Country-based Blocking
 * Uses MaxMind GeoLite2 database for IP geolocation
 * @module @nis2shield/express-middleware
 */

/* eslint-disable no-console */

// Note: maxmind package is an optional peer dependency
// Users must install separately: npm install maxmind

export interface GeoIPResult {
  country: string | null; // ISO country code (e.g., 'US', 'DE', 'IT')
  countryName: string | null; // Full country name
  continent: string | null; // Continent code
  isEU: boolean; // Is in European Union
}

export interface GeoIPServiceOptions {
  /** Path to MaxMind .mmdb database file */
  databasePath?: string;
  /** Fallback country code if lookup fails */
  defaultCountry?: string | null;
}

// Cache for the reader instance
let readerInstance: any = null;
let readerPath: string | null = null;

/**
 * GeoIPService provides IP geolocation using MaxMind GeoLite2 database.
 *
 * Prerequisites:
 * 1. Install maxmind: `npm install maxmind`
 * 2. Download GeoLite2-Country.mmdb from MaxMind (free registration required)
 * 3. Configure the database path in your app
 *
 * @example
 * ```typescript
 * import { GeoIPService } from '@nis2shield/express-middleware';
 *
 * // Initialize with database path
 * const geo = new GeoIPService({ databasePath: '/path/to/GeoLite2-Country.mmdb' });
 * await geo.init();
 *
 * const result = geo.lookup('8.8.8.8');
 * console.log(result.country); // 'US'
 * ```
 */
export class GeoIPService {
  private databasePath: string | null;
  private defaultCountry: string | null;
  private initialized: boolean = false;

  constructor(options: GeoIPServiceOptions = {}) {
    this.databasePath = options.databasePath || process.env.GEOIP_DATABASE_PATH || null;
    this.defaultCountry = options.defaultCountry ?? null;
  }

  /**
   * Initialize the GeoIP service (load the database)
   */
  async init(): Promise<boolean> {
    if (this.initialized && readerInstance) {
      return true;
    }

    if (!this.databasePath) {
      console.warn('[NIS2 Shield] GeoIP database path not configured. GeoIP blocking disabled.');
      return false;
    }

    try {
      // Dynamic require to make maxmind optional (avoid TypeScript compile error)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const maxmind = require('maxmind');

      // Only reload if path changed
      if (readerPath !== this.databasePath) {
        readerInstance = await maxmind.open(this.databasePath);
        readerPath = this.databasePath;
      }

      this.initialized = true;
      console.log('[NIS2 Shield] GeoIP database loaded successfully');
      return true;
    } catch (error: any) {
      if (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'MODULE_NOT_FOUND') {
        console.warn(
          '[NIS2 Shield] maxmind package not installed. Install with: npm install maxmind'
        );
      } else {
        console.error('[NIS2 Shield] Failed to load GeoIP database:', error.message);
      }
      return false;
    }
  }

  /**
   * Look up an IP address
   */
  lookup(ip: string): GeoIPResult {
    const defaultResult: GeoIPResult = {
      country: this.defaultCountry,
      countryName: null,
      continent: null,
      isEU: false,
    };

    if (!this.initialized || !readerInstance) {
      return defaultResult;
    }

    try {
      const result = readerInstance.get(ip);
      if (!result || !result.country) {
        return defaultResult;
      }

      return {
        country: result.country?.iso_code || null,
        countryName: result.country?.names?.en || null,
        continent: result.continent?.code || null,
        isEU: result.country?.is_in_european_union === true,
      };
    } catch (error) {
      return defaultResult;
    }
  }

  /**
   * Check if an IP is from a blocked country
   */
  isBlocked(ip: string, blockedCountries: string[]): boolean {
    if (!blockedCountries || blockedCountries.length === 0) {
      return false;
    }

    const result = this.lookup(ip);
    if (!result.country) {
      return false; // Allow if we can't determine country
    }

    return blockedCountries.includes(result.country);
  }

  /**
   * Check if an IP is from an allowed country (allowlist mode)
   */
  isAllowed(ip: string, allowedCountries: string[]): boolean {
    if (!allowedCountries || allowedCountries.length === 0) {
      return true; // Allow all if no allowlist
    }

    const result = this.lookup(ip);
    if (!result.country) {
      return false; // Block if we can't determine country in allowlist mode
    }

    return allowedCountries.includes(result.country);
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.initialized && readerInstance !== null;
  }
}

// Singleton instance
let defaultService: GeoIPService | null = null;

/**
 * Get or create the default GeoIPService instance
 */
export function getGeoIPService(options?: GeoIPServiceOptions): GeoIPService {
  if (!defaultService) {
    defaultService = new GeoIPService(options);
  }
  return defaultService;
}

/**
 * Initialize GeoIP service (call on app startup)
 */
export async function initGeoIP(databasePath?: string): Promise<boolean> {
  const service = getGeoIPService({ databasePath });
  return service.init();
}
