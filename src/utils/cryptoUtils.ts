/**
 * Cryptographic utilities for NIS2 Shield
 * @module @nis2shield/express-middleware
 */

import { createCipheriv, createHmac, randomBytes } from 'crypto';

/**
 * Encrypts a string using AES-256-CBC
 *
 * @param text - The text to encrypt
 * @param keyBase64 - The encryption key in Base64 format (must be 32 bytes when decoded)
 * @returns The encrypted text in Base64 format (IV + Ciphertext)
 */
export function encrypt(text: string, keyBase64: string): string {
    try {
        const key = Buffer.from(keyBase64, 'base64');
        if (key.length !== 32) {
            throw new Error('Encryption key must be 32 bytes (AES-256)');
        }

        const iv = randomBytes(16);
        const cipher = createCipheriv('aes-256-cbc', key, iv);

        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');

        // Return IV + Encrypted Data (both Base64) concatenated with ':'
        return `${iv.toString('base64')}:${encrypted}`;
    } catch (error) {
        console.error('[NIS2 Shield] Encryption error:', error);
        return '[ENCRYPTION_ERROR]';
    }
}

/**
 * Generates an HMAC-SHA256 hash for data integrity
 *
 * @param data - The data to sign (will be JSON stringified if object)
 * @param key - The integrity key
 * @returns The HMAC hash in hex format
 */
export function generateHMAC(data: unknown, key: string): string {
    try {
        const hmac = createHmac('sha256', key);
        const content = typeof data === 'string' ? data : JSON.stringify(data);
        hmac.update(content);
        return hmac.digest('hex');
    } catch (error) {
        console.error('[NIS2 Shield] HMAC generation error:', error);
        return '';
    }
}

/**
 * Masks an IP address (anonymization)
 * 
 * @param ip - The IP address (IPv4 or IPv6)
 * @returns The masked IP address
 */
export function anonymizeIP(ip: string): string {
    if (!ip) return 'unknown';

    // Check if IPv6 (contains ':')
    if (ip.includes(':')) {
        // IPv6: Keep first 3 groups (e.g. 2001:0db8:85a3:...) -> 2001:0db8:85a3:0000:0000:0000:0000:0000
        // Standard practice for GDPR is usually /48 or /64 prefix
        const parts = ip.split(':');
        if (parts.length > 3) {
            return `${parts.slice(0, 3).join(':')}:xxxx:xxxx:xxxx:xxxx:xxxx`;
        }
        return ip;
    }

    // IPv4: Mask last octet (e.g. 192.168.1.100 -> 192.168.1.0)
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts.slice(0, 3).join('.')}.0`;
    }

    return ip;
}
