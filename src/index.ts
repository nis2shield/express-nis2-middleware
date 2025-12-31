/**
 * NIS2 Shield Express Middleware
 * @module @nis2shield/express-middleware
 *
 * Provides NIS2 compliance middleware for Express.js applications.
 * Features forensic logging, active defense, and security headers.
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { handleAuditing } from './middleware/auditingMiddleware';
import { handleRateLimit } from './middleware/rateLimitMiddleware';
import { handleActiveDefense } from './middleware/activeDefenseMiddleware';
import { handleSessionGuard } from './middleware/sessionGuardMiddleware';
import { MemoryStore } from './utils/rateLimitStore';
import type { Nis2Config, Nis2Request, Nis2Middleware, ActiveDefenseConfig, RateLimiterStore, WebhookConfig } from './types';
import { mergeConfig } from './config/nis2Config';
import { randomUUID } from 'crypto';

// Re-export types
export * from './types';
export { mergeConfig, validateConfig, defineNis2Config, defaultNis2Config } from './config/nis2Config';
export { TorDetector, getTorDetector, warmTorCache } from './utils/torDetector';
export { GeoIPService, getGeoIPService, initGeoIP } from './utils/geoipService';
export type { GeoIPResult, GeoIPServiceOptions } from './utils/geoipService';
export { RedisStore } from './utils/redisStore';
export type { RedisStoreOptions } from './utils/redisStore';
export { WebhookNotifier, getWebhookNotifier, createWebhookNotifier } from './utils/webhookNotifier';

// Export Compliance Tools
export { ComplianceChecker } from './compliance/complianceChecker';
export { ComplianceReportGenerator } from './compliance/reportGenerator';
export type { ComplianceReport, ComplianceCheckResult } from './compliance/reportGenerator';

/**
 * Create NIS2 Shield middleware with the given configuration.
 *
 * @param userConfig - Partial configuration (merged with defaults)
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { nis2Shield } from '@nis2shield/express-middleware';
 *
 * const app = express();
 * app.use(nis2Shield({ enabled: true }));
 * ```
 */
export function nis2Shield(userConfig: Partial<Nis2Config> = {}): RequestHandler {
    const config = mergeConfig(userConfig);

    if (!config.enabled) {
        return (_req: Request, _res: Response, next: NextFunction): void => {
            next();
        };
    }

    // Initialize Rate Limit Store if enabled
    // Created once per middleware instance to isolate state
    let rateLimitStore: RateLimiterStore | null = null;
    if (config.activeDefense.rateLimit?.enabled) {
        const windowMs = config.activeDefense.rateLimit.windowMs || 60000;
        rateLimitStore = new MemoryStore(windowMs);
    }

    // Main middleware function
    const middleware: Nis2Middleware = (
        req: Nis2Request,
        res: Response,
        next: NextFunction
    ): void => {
        const startTime = Date.now();

        // Initialize NIS2 context on request
        req.nis2 = {
            startTime,
            rateLimited: false,
            requestId: randomUUID(),
        };

        // Initialize Webhook Notifier if configured
        if (config.webhooks) {
            // Just ensuring singleton is ready if needed, logic is inside utils
            // We can pass config.webhooks to middlewares if they need it
        }

        // Apply security headers
        if (config.securityHeaders.enabled) {
            applySecurityHeaders(res, config);
        }

        // Define proceed function to handle next steps after async checks
        const proceed = () => {
            // Handle auditing when response finishes
            if (config.logging.enabled) {
                res.on('finish', () => {
                    handleAuditing(req, res, config, startTime);
                });
            }
            next();
        };

        // Handle Active Defense
        if (config.activeDefense) {
            handleActiveDefense(req, res, (err?: unknown) => {
                if (err || res.headersSent) return;

                // Handle Session Guard
                if (config.activeDefense.sessionGuard?.enabled) {
                    handleSessionGuard(req, res, () => {
                        if (res.headersSent) return;

                        // Handle Rate Limiting (Async)
                        if (config.activeDefense.rateLimit?.enabled && rateLimitStore) {
                            handleRateLimit(req, res, (rlErr?: unknown) => {
                                if (rlErr || res.headersSent) return;
                                proceed();
                            }, config.activeDefense.rateLimit, rateLimitStore!);
                        } else {
                            proceed();
                        }
                    }, config.activeDefense.sessionGuard!, config.webhooks as WebhookConfig);
                } else {
                    // Handle Rate Limiting (Async) - Code Duplication avoided by refactoring? 
                    // For now, minimal intrusion logic:
                    if (config.activeDefense.rateLimit?.enabled && rateLimitStore) {
                        handleRateLimit(req, res, (rlErr?: unknown) => {
                            if (rlErr || res.headersSent) return;
                            proceed();
                        }, config.activeDefense.rateLimit, rateLimitStore!);
                    } else {
                        proceed();
                    }
                }
            }, config.activeDefense as ActiveDefenseConfig, config.webhooks as WebhookConfig);
        } else {
            proceed();
        }
    };

    return middleware as RequestHandler;
}

/**
 * Apply security headers to response
 */
function applySecurityHeaders(res: Response, config: Nis2Config): void {
    const headers = config.securityHeaders;

    // HSTS
    if (headers.hsts) {
        const maxAge = headers.hstsMaxAge ?? 31536000;
        res.setHeader('Strict-Transport-Security', `max-age=${maxAge}; includeSubDomains; preload`);
    }

    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options
    if (headers.xFrameOptions) {
        res.setHeader('X-Frame-Options', headers.xFrameOptions);
    }

    // Content-Security-Policy
    if (headers.csp) {
        res.setHeader('Content-Security-Policy', headers.csp);
    }

    // Referrer-Policy
    if (headers.referrerPolicy) {
        res.setHeader('Referrer-Policy', headers.referrerPolicy);
    }

    // Permissions-Policy
    res.setHeader(
        'Permissions-Policy',
        'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()'
    );
}

// Default export
export default nis2Shield;
