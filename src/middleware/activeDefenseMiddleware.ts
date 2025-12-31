/**
 * Active Defense Middleware
 * @module @nis2shield/express-middleware
 */

import { Response, NextFunction } from 'express';
import { Nis2Request, ActiveDefenseConfig, WebhookConfig, WebhookEventType } from '../types';
import { getClientIP } from '../utils/ipUtils';
import { getTorDetector } from '../utils/torDetector';
import { getGeoIPService } from '../utils/geoipService';
import { getWebhookNotifier } from '../utils/webhookNotifier';

// Track if GeoIP has been initialized
let geoipInitialized = false;

export function handleActiveDefense(
    req: Nis2Request,
    res: Response,
    next: NextFunction,
    config: ActiveDefenseConfig,
    webhookConfig?: WebhookConfig
): void {
    const clientIP = getClientIP(req);
    const notifier = getWebhookNotifier(webhookConfig);
    const notify = (event: WebhookEventType, message: string, metadata?: any) => {
        if (notifier) {
            notifier.notify({
                event,
                ip: clientIP,
                path: req.originalUrl || req.url,
                method: req.method,
                message,
                metadata
            });
        }
    };

    // 1. Check blocked static IPs
    if (config.blockedIPs && config.blockedIPs.includes(clientIP)) {
        blockRequest(res, 'Access Denied: IP address is blocked.');
        notify('blocked_ip', 'Blocked static IP', { blockedIP: clientIP });
        return;
    }

    // 2. Check Tor Exit Nodes (using real Tor detection)
    if (config.blockTor) {
        const detector = getTorDetector();

        // Use sync check for non-blocking performance
        if (detector.isTorExitNodeSync(clientIP)) {
            blockRequest(res, 'Access Denied: Tor exit nodes are not allowed.');
            notify('tor_blocked', 'Blocked Tor exit node');
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
                    notify('geo_blocked', `Blocked country: ${result.country}`, { country: result.country });
                    return;
                }
            }

            // Check allowlist mode
            if (config.allowedCountries && config.allowedCountries.length > 0) {
                if (!geoService.isAllowed(clientIP, config.allowedCountries)) {
                    const result = geoService.lookup(clientIP);
                    blockRequest(res, `Access Denied: Access from ${result.countryName || result.country || 'your region'} is not allowed.`);
                    notify('geo_blocked', `Blocked non-allowlisted country: ${result.country}`, { country: result.country });
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
