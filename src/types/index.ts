/**
 * NIS2 Shield Configuration Types
 * @module @nis2shield/express-middleware
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Logging configuration options
 */
export interface LoggingConfig {
    /** Enable/disable logging middleware */
    enabled: boolean;
    /** Anonymize IP addresses (mask last octet) */
    anonymizeIP: boolean;
    /** Encrypt PII fields with AES-256 */
    encryptPII: boolean;
    /** Fields to encrypt (default: ['userId', 'email']) */
    piiFields: string[];
    /** Log output destination */
    output: 'console' | 'file' | 'custom';
    /** Custom log file path (when output is 'file') */
    filePath?: string;
    /** Maximum file size in bytes before rotation (default: 10MB) */
    maxFileSize?: number;
    /** Maximum number of rotated files to keep (default: 5) */
    maxFiles?: number;
    /** Custom log handler (when output is 'custom') */
    customHandler?: (log: AuditLog) => void;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
    /** Enable/disable rate limiting */
    enabled: boolean;
    /** Time window in milliseconds */
    windowMs: number;
    /** Max requests per window */
    max: number;
    /** Use IP or user ID for tracking */
    keyGenerator?: (req: Request) => string;
    /** Custom response when limit exceeded */
    handler?: (req: Request, res: Response) => void;
}

/**
 * Active defense configuration
 */
export interface ActiveDefenseConfig {
    /** Rate limiting settings */
    rateLimit: RateLimitConfig;
    /** Block known Tor exit nodes */
    blockTor: boolean;
    /** Static list of blocked IP addresses */
    blockedIPs: string[];
    /** Countries to block (ISO 3166-1 alpha-2 codes, e.g., ['RU', 'CN']) */
    blockedCountries?: string[];
    /** Countries to allow (allowlist mode, all others blocked) */
    allowedCountries?: string[];
    /** Path to MaxMind GeoIP database */
    geoipDatabasePath?: string;
}

/**
 * Security headers configuration
 */
export interface SecurityHeadersConfig {
    /** Enable/disable security headers */
    enabled: boolean;
    /** Enable HSTS header */
    hsts: boolean;
    /** HSTS max-age in seconds (default: 31536000 = 1 year) */
    hstsMaxAge?: number;
    /** Content Security Policy directive */
    csp?: string;
    /** X-Frame-Options value */
    xFrameOptions?: 'DENY' | 'SAMEORIGIN';
    /** Referrer-Policy value */
    referrerPolicy?: string;
}

/**
 * Main NIS2 Shield configuration
 */
export interface Nis2Config {
    /** Enable/disable the entire middleware */
    enabled: boolean;
    /** AES-256 encryption key (Base64 encoded, 32 bytes) */
    encryptionKey?: string;
    /** HMAC-SHA256 integrity key */
    integrityKey?: string;
    /** Logging configuration */
    logging: Partial<LoggingConfig>;
    /** Active defense configuration */
    activeDefense: Partial<ActiveDefenseConfig>;
    /** Security headers configuration */
    securityHeaders: Partial<SecurityHeadersConfig>;
}

/**
 * Structured audit log entry
 */
export interface AuditLog {
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Application name */
    app_name: string;
    /** Log level */
    level: 'INFO' | 'WARN' | 'ERROR';
    /** Module identifier */
    module: 'nis2_shield';
    /** Log type */
    type: 'audit_log' | 'security_event' | 'rate_limit';
    /** Request details */
    request: {
        method: string;
        path: string;
        ip: string;
        user_agent: string;
    };
    /** Response details */
    response: {
        status: number;
        duration_ms: number;
    };
    /** User identifier (encrypted if PII protection enabled) */
    user_id?: string;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
    /** HMAC-SHA256 integrity hash */
    integrity_hash?: string;
}

/**
 * Extended Express Request with NIS2 context
 */
export interface Nis2Request extends Request {
    nis2?: {
        /** Request start time */
        startTime: number;
        /** Whether request was rate limited */
        rateLimited: boolean;
        /** Request ID for correlation */
        requestId: string;
        /** Extracted user ID (if available) */
        userId?: string;
    };
}

/**
 * NIS2 Shield middleware function type
 */
export type Nis2Middleware = (
    req: Nis2Request,
    res: Response,
    next: NextFunction
) => void | Promise<void>;

/**
 * Rate limiter store interface (for custom implementations)
 */
export interface RateLimiterStore {
    increment(key: string): Promise<{ count: number; resetTime: number }>;
    decrement(key: string): Promise<void>;
    reset(key: string): Promise<void>;
}
