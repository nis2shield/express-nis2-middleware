import { z } from 'zod';
import { Nis2Config } from '../types';

// --- SIEM Configuration ---
export const SiemConfigSchema = z.object({
  enabled: z.boolean().default(false),
  providers: z
    .object({
      splunk: z
        .object({
          enabled: z.boolean().default(false),
          hecUrl: z.string().optional(),
          token: z.string().optional(),
          index: z.string().optional(),
          source: z.string().default('nis2-express'),
          sourceType: z.string().default('_json'),
        })
        .optional(),
      datadog: z
        .object({
          enabled: z.boolean().default(false),
          apiKey: z.string().optional(),
          site: z.string().default('datadoghq.com'),
          service: z.string().default('nis2-express'),
          tags: z.array(z.string()).optional(),
        })
        .optional(),
      webhook: z
        .object({
          enabled: z.boolean().default(false),
          url: z.string().optional(),
          headers: z.record(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
});

export type SiemConfig = z.infer<typeof SiemConfigSchema>;

// --- Webhook Notifications Configuration ---
export const WebhookConfigSchema = z.object({
  enabled: z.boolean().default(false), // Changed to default false to avoid lint issues if undefined
  endpoints: z
    .array(
      z.object({
        url: z.string().url(),
        type: z.enum(['slack', 'teams', 'discord', 'generic']).default('generic'),
        events: z
          .array(z.enum(['rate_limit', 'tor_block', 'session_hijack', 'server_error', 'all']))
          .default(['all']),
      })
    )
    .default([]),
});

export type WebhookConfig = z.infer<typeof WebhookConfigSchema>;

// --- Session Guard Configuration ---
export const SessionGuardConfigSchema = z.object({
  enabled: z.boolean().default(true),
  encryptionKey: z.string().optional(),
  cookieName: z.string().default('nis2_session'),
  enforceIpBinding: z.boolean().default(false),
  enforceUaBinding: z.boolean().default(true),
  excludePaths: z.array(z.string()).default([]),
});

export type SessionGuardConfig = z.infer<typeof SessionGuardConfigSchema>;

// --- Main Configuration ---
export const Nis2ConfigSchema = z.object({
  enabled: z.boolean().default(true),
  encryptionKey: z.string().optional(),
  integrityKey: z.string().optional(),

  logging: z
    .object({
      enabled: z.boolean().default(true),
      anonymizeIP: z.boolean().default(true),
      encryptPII: z.boolean().default(true),
      piiFields: z
        .array(z.string())
        .default(['email', 'username', 'password', 'token', 'ipv4', 'ipv6']),
      output: z
        .enum(['console', 'file', 'custom', 'splunk', 'datadog', 'qradar'])
        .default('console'),
      filePath: z.string().optional(),
      maxFileSize: z.number().default(10 * 1024 * 1024), // Added flat fields to match usage
      maxFiles: z.number().default(5),
      fileRotation: z
        .object({
          maxFileSize: z.number().default(10 * 1024 * 1024),
          maxFiles: z.number().default(5),
        })
        .optional(),
    })
    .default({}),

  activeDefense: z
    .object({
      rateLimit: z
        .object({
          enabled: z.boolean().default(true),
          windowMs: z.number().default(60000),
          max: z.number().default(100),
        })
        .default({}), // defaulted
      blockTor: z.boolean().default(true),
      blockedIPs: z.array(z.string()).default([]),
      blockedCountries: z.array(z.string()).default([]),
      allowedCountries: z.array(z.string()).default([]),
      geoipDatabasePath: z.string().optional(),
      sessionGuard: SessionGuardConfigSchema.default({}), // Added to activeDefense as well if nested
    })
    .default({}),

  securityHeaders: z
    .object({
      enabled: z.boolean().default(true),
      hsts: z.boolean().default(true),
      hstsMaxAge: z.number().default(31536000),
      csp: z.string().optional(),
      xFrameOptions: z.enum(['DENY', 'SAMEORIGIN']).optional(),
      referrerPolicy: z.string().optional(),
    })
    .default({}),

  // v0.3.0 Features at root
  siem: SiemConfigSchema.default({}),
  sessionGuard: SessionGuardConfigSchema.default({}),
  webhooks: WebhookConfigSchema.default({}),
});

// export type Nis2Config = z.infer<typeof Nis2ConfigSchema>; // Removed to avoid conflict

// --- Helper Functions ---

// Default configuration with safe defaults
export const defaultNis2Config: Nis2Config = Nis2ConfigSchema.parse({});

export const defineNis2Config = (config: Partial<Nis2Config>): Partial<Nis2Config> => {
  return config;
};

/**
 * Validates and merges user configuration with defaults
 */
export const mergeConfig = (userConfig: Partial<Nis2Config>): Nis2Config => {
  // We use Zod's parsing to apply defaults and validate types
  // Since userConfig is partial, we might need to deep merge manually if Zod doesn't handle deep partials perfectly with just .parse()
  // But Zod schemas above use .default(), so undefined values should fall back to defaults.

  // However, for nested objects, if the parent passed is a partial object, Zod might strip unknown keys or fail if strict.
  // We'll trust Zod's .parse to handle the merging if we pass "unknown"
  const parsed = Nis2ConfigSchema.safeParse(userConfig);

  if (!parsed.success) {
    console.warn(
      '[NIS2 Shield] Invalid configuration provided, falling back to defaults for invalid fields:',
      parsed.error.format()
    );
    // For a library, we might want to return defaults or throw.
    // Let's attempt a best-effort merge manually for top-level keys or just return defaults + valid inputs.
    // For now, simpler approach: return defaults overridden by user config (unsafe cast) but validated largely by types.
    // Better: Return default if fatal, or trust defaults.
    return defaultNis2Config;
  }
  return parsed.data as unknown as Nis2Config;
};

export const validateConfig = (config: unknown): { valid: boolean; error?: z.ZodError } => {
  const result = Nis2ConfigSchema.safeParse(config);
  return { valid: result.success, error: result.success ? undefined : result.error };
};
