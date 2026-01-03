/**
 * Log Formatter Utility
 * @module @nis2shield/express-middleware
 */

import { AuditLog, LoggingConfig } from '../types';
import { anonymizeIP } from './ipUtils';
import { encrypt, generateHMAC } from './cryptoUtils';

/**
 * Formats a log entry according to NIS2 JSON structure
 */
export function formatLogEntry(
  baseLog: Omit<AuditLog, 'integrity_hash' | 'timestamp'>,
  config: Partial<LoggingConfig>,
  encryptionKey?: string,
  integrityKey?: string
): AuditLog {
  const log: AuditLog = {
    ...baseLog,
    timestamp: new Date().toISOString(),
  };

  // 1. IP Anonymization
  if (config.anonymizeIP) {
    log.request.ip = anonymizeIP(log.request.ip);
  }

  // 2. PII Encryption
  if (config.encryptPII && encryptionKey) {
    const fieldsToEncrypt = config.piiFields || ['userId', 'email'];

    // Encrypt user ID if present
    if (log.user?.id) {
      log.user.id = encrypt(log.user.id, encryptionKey);
    }

    // Encrypt fields in metadata
    if (log.metadata) {
      const metadata = { ...log.metadata };
      for (const field of fieldsToEncrypt) {
        if (Object.prototype.hasOwnProperty.call(metadata, field)) {
          const value = metadata[field];
          if (typeof value === 'string') {
            metadata[field] = encrypt(value, encryptionKey);
          }
        }
      }
      log.metadata = metadata;
    }
  }

  // 3. Integrity Signing (HMAC)
  if (integrityKey) {
    // We sign the log object excluding the hash itself
    log.integrity_hash = generateHMAC(log, integrityKey);
  }

  return log;
}
