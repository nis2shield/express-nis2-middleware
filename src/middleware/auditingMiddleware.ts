/**
 * NIS2 Auditing Middleware
 * Handles forensic logging of requests and responses
 */

import { Response } from 'express';
import { Nis2Config, Nis2Request, AuditLog, LoggingConfig } from '../types';
import { getClientIP } from '../utils/ipUtils';
import { formatLogEntry } from '../utils/logFormatter';
import { getFileTransport } from '../utils/fileTransport';
import { TransportFactory } from '../utils/transportFactory';

export function handleAuditing(
    req: Nis2Request,
    res: Response,
    config: Nis2Config,
    startTime: number
): void {
    const duration = Date.now() - startTime;
    const clientIP = getClientIP(req);

    // Extract user ID if available
    const userId = req.nis2?.userId || (req as any).user?.id || (req as any).user?.email;

    const baseLog: Omit<AuditLog, 'integrity_hash' | 'timestamp'> = {
        app_name: process.env.npm_package_name || 'express-app',
        module: 'nis2_shield',
        type: 'audit_log',
        level: res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARN' : 'INFO',
        request: {
            method: req.method,
            path: req.originalUrl || req.url,
            ip: clientIP,
            user_agent: req.get('user-agent') || 'unknown',
        },
        response: {
            status: res.statusCode,
            duration_ms: duration,
        },
        user_id: userId,
        metadata: {
            ...req.body && !isSensitiveBody(req) ? { body_summary: '...' } : {},
        },
    };

    const auditLog = formatLogEntry(
        baseLog,
        config.logging,
        config.encryptionKey,
        config.integrityKey
    );

    outputLog(auditLog, config.logging as LoggingConfig);
}

function outputLog(log: AuditLog, config: LoggingConfig): void {
    const output = JSON.stringify(log);

    if (config.output === 'file') {
        if (!config.filePath) {
            console.error('[NIS2 Shield] File output enabled but no filePath provided');
            return;
        }

        const transport = getFileTransport({
            filePath: config.filePath,
            maxSize: config.maxFileSize,
            maxFiles: config.maxFiles,
        });
        transport.write(output);
    } else if (config.output === 'custom' && config.customHandler) {
        config.customHandler(log);
    } else if (['splunk', 'datadog', 'qradar'].includes(config.output)) {
        const transport = TransportFactory.getTransport(config);
        if (transport) {
            transport.log(log);
        } else {
            console.warn('[NIS2 Shield] SIEM transport not initialized or config missing. Falling back to console.');
            console.log(output);
        }
    } else {
        if (log.level === 'ERROR') {
            console.error(output);
        } else {
            console.log(output);
        }
    }
}

/**
 * Rudimentary check to avoid logging sensitive bodies like passwords
 */
function isSensitiveBody(req: Nis2Request): boolean {
    const path = (req.originalUrl || '').toLowerCase();
    return path.includes('login') || path.includes('auth') || path.includes('password');
}
