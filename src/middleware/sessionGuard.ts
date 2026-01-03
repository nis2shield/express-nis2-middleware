import { Request, Response, NextFunction } from 'express';
import { createHmac } from 'crypto';
import { SessionGuardConfig } from '../config/nis2Config';
import { WebhookNotifier } from '../utils/webhookNotifier';

export const sessionGuard = (config: SessionGuardConfig, notifier?: WebhookNotifier) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.enabled) return next();

    // Skip excluded paths
    if (config.excludePaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Attempt to extract session ID (from cookie or header)
    const sessionId = req.cookies?.[config.cookieName] || req.headers['authorization'];

    // If no session, nothing to guard (stateless request)
    if (!sessionId) return next();

    // 1. Generate current fingerprint
    const ip = config.enforceIpBinding
      ? req.ip || req.socket.remoteAddress || 'unknown'
      : 'ignored-ip';
    const ua = config.enforceUaBinding ? req.headers['user-agent'] || 'unknown' : 'ignored-ua';

    // Create a fingerprint hash
    const currentFingerprint = createHmac('sha256', config.encryptionKey || 'default-secret')
      .update(`${ip}|${ua}`)
      .digest('hex');

    // 2. Compare with stored fingerprint (Simulated for this middleware)
    // In a real scenario, this fingerprint would be retrieved from a session store (Redis/DB)
    // keyed by the sessionId.
    // Since this is a lightweight middleware, we rely on signed cookies or tokens.
    // For MVP, we will assume the fingerprint is passed in a custom header OR verify logic
    // is handled by the application, but we provide the utility to generate/check it.

    // However, strictly for NIS2 Art 21.2.c (Operational Continuity), we must DETECT changes.
    // If the client sends a "X-Nis2-Fingerprint" header (client-side collected), we verify it.

    const clientSideFingerprint = req.headers['x-nis2-fingerprint'];
    if (clientSideFingerprint && clientSideFingerprint !== currentFingerprint) {
      // Hijacking Attempt Detected!
      console.warn(`[NIS2 SessionGuard] Hijacking detected! IP: ${ip}, UA: ${ua}`);

      if (notifier) {
        notifier.notify('session_hijack', {
          ip,
          user_agent: ua,
          path: req.path,
          user: (req as any).user?.id || 'anonymous',
        });
      }

      res.status(403).json({
        error: 'Session integrity violation',
        code: 'NIS2_SESSION_HIJACK',
        message: 'Your network environment changed suspiciously. Please login again.',
      });
      return;
    }

    // Attach fingerprint to request for downstream use (e.g., login handler can store it)
    (req as any).nis2SessionFingerprint = currentFingerprint;

    next();
  };
};
