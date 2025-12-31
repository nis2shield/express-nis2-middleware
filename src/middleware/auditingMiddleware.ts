/**
 * NIS2 Auditing Middleware
 * Handles forensic logging of requests and responses
 */

import { Response } from 'express';
import { Nis2Config, Nis2Request, AuditLog } from '../types';
import { getClientIP } from '../utils/ipUtils';
import { formatLogEntry } from '../utils/logFormatter';

export function handleAuditing(
    req: Nis2Request,
    res: Response,
    config: Nis2Config,
    startTime: number
): void {
    const duration = Date.now() - startTime;
    const clientIP = getClientIP(req);

    // Extract user ID if available (e.g. from req.user or custom logic)
    // This is a placeholder - usually frameworks like Passport add req.user
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
            // Allow passing custom metadata via req.nis2 if needed
            ...req.body && !isSensitiveBody(req) ? { body_summary: '...' } : {}, // Placeholder for safer body logging
        },
    };

    const auditLog = formatLogEntry(
        baseLog,
        config.logging,
        config.encryptionKey,
        config.integrityKey
    );

    outputLog(auditLog, config.logging);
}

import { getFileTransport } from '../utils/fileTransport';

function outputLog(log: AuditLog, config: Nis2Config['logging']): void {
    const output = JSON.stringify(log);

    if (config.output === 'file' && config.filePath) {
        // Use FileTransport for file output with rotation
        const transport = getFileTransport({
            filePath: config.filePath,
            maxSize: config.maxFileSize,
            maxFiles: config.maxFiles,
        });
        transport.write(output);
    } else if (config.output === 'custom' && config.customHandler) {
        config.customHandler(log);
    } else {
        // Console output (Standard Streams)
        // STDOUT for Info, STDERR for Error
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
