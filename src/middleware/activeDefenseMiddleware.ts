/**
 * Active Defense Middleware
 * @module @nis2shield/express-middleware
 */

import { Response, NextFunction } from 'express';
import { Nis2Request, ActiveDefenseConfig } from '../types';
import { getClientIP } from '../utils/ipUtils';
import { getTorDetector } from '../utils/torDetector';
import { getGeoIPService } from '../utils/geoipService';

// Track if GeoIP has been initialized
let geoipInitialized = false;

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
        if (detector.isTorExitNodeSync(clientIP)) {
            blockRequest(res, 'Access Denied: Tor exit nodes are not allowed.');
            return;
        }

        // Trigger async cache refresh in background
        detector.isTorExitNode(clientIP).catch(() => { });
    }

    // 3. GeoIP Country Blocking
    const hasGeoBlocking = (config.blockedCountries && config.blockedCountries.length > 0) ||
        (config.allowedCountries && config.allowedCountries.length > 0);

    if (hasGeoBlocking) {
        const geoService = getGeoIPService({ databasePath: config.geoipDatabasePath });

        // Lazy init on first request with geo-blocking
        if (!geoipInitialized) {
            geoService.init().then(() => {
                geoipInitialized = true;
            }).catch(() => { });
        }

        if (geoService.isReady()) {
            // Check blocklist mode
            if (config.blockedCountries && config.blockedCountries.length > 0) {
                if (geoService.isBlocked(clientIP, config.blockedCountries)) {
                    const result = geoService.lookup(clientIP);
                    blockRequest(res, `Access Denied: Access from ${result.countryName || result.country || 'your region'} is not allowed.`);
                    return;
                }
            }

            // Check allowlist mode
            if (config.allowedCountries && config.allowedCountries.length > 0) {
                if (!geoService.isAllowed(clientIP, config.allowedCountries)) {
                    const result = geoService.lookup(clientIP);
                    blockRequest(res, `Access Denied: Access from ${result.countryName || result.country || 'your region'} is not allowed.`);
                    return;
                }
            }
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
