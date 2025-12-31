/**
 * Active Defense Middleware
 * @module @nis2shield/express-middleware
 */

import { Response, NextFunction } from 'express';
import { Nis2Request, ActiveDefenseConfig } from '../types';
import { getClientIP } from '../utils/ipUtils';
import { getTorDetector } from '../utils/torDetector';

export function handleActiveDefense(
    req: Nis2Request,
    res: Response,
    next: NextFunction,
    config: ActiveDefenseConfig
): void {
    const clientIP = getClientIP(req);

    // 1. Check blocked static IPs
    if (config.blockedIPs && config.blockedIPs.includes(clientIP)) {
        blockRequest(res, 'Access Denied: IP address is blocked.');
        return;
    }

    // 2. Check Tor Exit Nodes (using real Tor detection)
    if (config.blockTor) {
        const detector = getTorDetector();

        // Use sync check for non-blocking performance
        // The cache is warmed on first async request, then sync checks are instant
        if (detector.isTorExitNodeSync(clientIP)) {
            blockRequest(res, 'Access Denied: Tor exit nodes are not allowed.');
            return;
        }

        // Optionally trigger async cache refresh in background
        // This won't block the request but ensures cache stays fresh
        detector.isTorExitNode(clientIP).catch(() => {
            // Silently ignore - sync check already handled this request
        });
    }

    next();
}

function blockRequest(res: Response, message: string): void {
    res.status(403).json({
        error: 'Access Denied',
        message: message,
        timestamp: new Date().toISOString()
    });
}
