/**
 * NIS2 Auditing Middleware
 * Handles forensic logging of requests and responses
 */

import { Response } from 'express';
import { Nis2Config, Nis2Request, AuditLog, LoggingConfig } from '../types';
import { getClientIP } from '../utils/ipUtils';
import { formatLogEntry } from '../utils/logFormatter';
import { getFileTransport } from '../utils/fileTransport';
import { SiemTransportManager } from '../utils/siemTransport';

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

    outputLog(auditLog, config.logging as LoggingConfig, config);
}

function outputLog(log: AuditLog, config: LoggingConfig, fullConfig: Nis2Config): void {
    const output = JSON.stringify(log);

    // 1. Console Output
    if (config.output === 'console') {
        if (log.level === 'ERROR') {
            console.error(output);
        } else {
            console.log(output);
        }
    }
    // 2. File Output
    else if (config.output === 'file') {
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
    }
    // 3. Custom Output
    else if (config.output === 'custom' && config.customHandler) {
        config.customHandler(log);
    }

    // 4. SIEM Broadcast (Always runs if enabled, regardless of primary output)
    if (fullConfig.siem && fullConfig.siem.enabled) {
        const siemManager = new SiemTransportManager(fullConfig.siem); // In real app, singleton this
        siemManager.broadcast(log);
    }
}

/**
 * Rudimentary check to avoid logging sensitive bodies like passwords
 */
function isSensitiveBody(req: Nis2Request): boolean {
    const path = (req.originalUrl || '').toLowerCase();
    return path.includes('login') || path.includes('auth') || path.includes('password');
}
