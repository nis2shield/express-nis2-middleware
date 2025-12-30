/**
 * NIS2 Shield Configuration Schema and Defaults
 * @module @nis2shield/express-middleware
 */

import { z } from 'zod';
import type { Nis2Config, LoggingConfig, ActiveDefenseConfig, SecurityHeadersConfig } from '../types';

/**
 * Zod schema for configuration validation
 */
export const nis2ConfigSchema = z.object({
    enabled: z.boolean().default(true),
    encryptionKey: z.string().optional(),
    integrityKey: z.string().optional(),
    logging: z
        .object({
            enabled: z.boolean().default(true),
            anonymizeIP: z.boolean().default(true),
            encryptPII: z.boolean().default(true),
            piiFields: z.array(z.string()).default(['userId', 'email']),
            output: z.enum(['console', 'file', 'custom']).default('console'),
            filePath: z.string().optional(),
            customHandler: z.function().optional(),
        })
        .default({}),
    activeDefense: z
        .object({
            rateLimit: z
                .object({
                    enabled: z.boolean().default(true),
                    windowMs: z.number().default(60000), // 1 minute
                    max: z.number().default(100),
                    keyGenerator: z.function().optional(),
                    handler: z.function().optional(),
                })
                .default({}),
            blockTor: z.boolean().default(false),
            blockedIPs: z.array(z.string()).default([]),
        })
        .default({}),
    securityHeaders: z
        .object({
            enabled: z.boolean().default(true),
            hsts: z.boolean().default(true),
            hstsMaxAge: z.number().default(31536000), // 1 year
            csp: z.string().optional(),
            xFrameOptions: z.enum(['DENY', 'SAMEORIGIN']).default('DENY'),
            referrerPolicy: z.string().default('strict-origin-when-cross-origin'),
        })
        .default({}),
});

/**
 * Default logging configuration
 */
export const defaultLoggingConfig: LoggingConfig = {
    enabled: true,
    anonymizeIP: true,
    encryptPII: true,
    piiFields: ['userId', 'email'],
    output: 'console',
};

/**
 * Default rate limit configuration
 */
export const defaultRateLimitConfig = {
    enabled: true,
    windowMs: 60000, // 1 minute
    max: 100,
};

/**
 * Default active defense configuration
 */
export const defaultActiveDefenseConfig: ActiveDefenseConfig = {
    rateLimit: defaultRateLimitConfig,
    blockTor: false,
    blockedIPs: [],
};

/**
 * Default security headers configuration
 */
export const defaultSecurityHeadersConfig: SecurityHeadersConfig = {
    enabled: true,
    hsts: true,
    hstsMaxAge: 31536000,
    xFrameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
};

/**
 * Default full configuration
 */
export const defaultNis2Config: Nis2Config = {
    enabled: true,
    logging: defaultLoggingConfig,
    activeDefense: defaultActiveDefenseConfig,
    securityHeaders: defaultSecurityHeadersConfig,
};

/**
 * Configuration helper for better type inference and autocompletion
 *
 * @param config - The NIS2 configuration object
 * @returns The configuration object, strictly typed
 *
 * @example
 * ```typescript
 * import { defineNis2Config } from '@nis2shield/express-middleware';
 *
 * const config = defineNis2Config({
 *   enabled: true,
 *   logging: { output: 'console' }
 * });
 * ```
 */
export function defineNis2Config(config: Partial<Nis2Config>): Partial<Nis2Config> {
    return config;
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(userConfig: Partial<Nis2Config> = {}): Nis2Config {
    return {
        enabled: userConfig.enabled ?? true,
        encryptionKey: userConfig.encryptionKey,
        integrityKey: userConfig.integrityKey,
        logging: {
            ...defaultLoggingConfig,
            ...userConfig.logging,
        },
        activeDefense: {
            ...defaultActiveDefenseConfig,
            ...userConfig.activeDefense,
            rateLimit: {
                ...defaultRateLimitConfig,
                ...userConfig.activeDefense?.rateLimit,
            },
        },
        securityHeaders: {
            ...defaultSecurityHeadersConfig,
            ...userConfig.securityHeaders,
        },
    };
}

/**
 * Validate configuration
 */
export function validateConfig(config: unknown): Nis2Config {
    const result = nis2ConfigSchema.safeParse(config);
    if (!result.success) {
        console.error('[NIS2 Shield] Invalid configuration:', result.error.issues);
        throw new Error(`Invalid NIS2 Shield configuration: ${result.error.message}`);
    }
    return result.data as unknown as Nis2Config;
}
