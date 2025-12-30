/**
 * Active Defense Middleware
 * @module @nis2shield/express-middleware
 */

import { Response, NextFunction } from 'express';
import { Nis2Request, ActiveDefenseConfig } from '../types';
import { getClientIP } from '../utils/ipUtils';

// Helper to check if IP is a Tor exit node
// In a real implementation, this would query a dynamic list or service
// For MVP, we'll use a placeholder logic or allow users to provide the list
const KNOWN_TOR_IPS = new Set<string>([
    // Placeholder for Tor IPs
]);

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

    // 2. Check Tor Exit Nodes
    if (config.blockTor) {
        if (KNOWN_TOR_IPS.has(clientIP) || isSimulatedTor(clientIP)) {
            blockRequest(res, 'Access Denied: Tor exit nodes are not allowed.');
            return;
        }
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

/**
 * For testing/demo purposes, assume 1.1.1.1 is valid but 6.6.6.6 is Tor
 * In production this would check against a real threat intel feed
 */
function isSimulatedTor(ip: string): boolean {
    // Hardcoded for testing active defense logic without external dependency
    return ip === '6.6.6.6';
}
