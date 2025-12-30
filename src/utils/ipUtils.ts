/**
 * IP Address utilities
 * @module @nis2shield/express-middleware
 */

import { Request } from 'express';

/**
 * Extracts the client IP address from the request
 * Handles X-Forwarded-For headers behind proxies
 */
export function getClientIP(req: Request): string {
    // Check X-Forwarded-For header
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // Header can be string or array of strings
        const ips = Array.isArray(forwarded) ? forwarded : forwarded.split(',');
        // First IP is the original client
        return ips[0].trim();
    }

    // Fallback to connection remote address
    return req.socket.remoteAddress || 'unknown';
}

/**
 * Masks an IP address (anonymization) for GDPR compliance
 * 
 * @param ip - The IP address (IPv4 or IPv6)
 * @returns The masked IP address
 */
export function anonymizeIP(ip: string): string {
    if (!ip || ip === 'unknown') return 'unknown';

    // Normalize IPv6 mapped IPv4 (e.g. ::ffff:192.168.1.1)
    if (ip.startsWith('::ffff:')) {
        ip = ip.substring(7);
    }

    // Check if IPv6 (contains ':')
    if (ip.includes(':')) {
        // IPv6: Keep first 3 groups (e.g. 2001:0db8:85a3:...) -> 2001:0db8:85a3:xxxx:xxxx:xxxx:xxxx:xxxx
        // Standard practice for GDPR is usually /48 or /64 prefix
        const parts = ip.split(':');
        if (parts.length >= 3) {
            return `${parts.slice(0, 3).join(':')}:xxxx:xxxx:xxxx:xxxx:xxxx`;
        }
        return ip; // Fallback if parsing fails
    }

    // IPv4: Mask last octet (e.g. 192.168.1.100 -> 192.168.1.0)
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts.slice(0, 3).join('.')}.0`;
    }

    return ip;
}
