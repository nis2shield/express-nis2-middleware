import { Response, NextFunction } from 'express';
import { Nis2Request, SessionGuardConfig, WebhookEventType, WebhookConfig } from '../types';
import { getClientIP } from '../utils/ipUtils';
import { getWebhookNotifier } from '../utils/webhookNotifier';

/**
 * Session Guard Middleware
 * Detects session hijacking attempts by validating IP and User-Agent consistency
 */
export function handleSessionGuard(
  req: Nis2Request,
  res: Response,
  next: NextFunction,
  config: SessionGuardConfig,
  webhookConfig?: WebhookConfig
): void {
  if (!config.enabled) {
    next();
    return;
  }

  // Check if session exists (requires express-session or similar)
  const session = (req as any).session;
  if (!session) {
    // If session middleware is missing or no session is active, skip checks
    next();
    return;
  }

  const currentIP = getClientIP(req);
  const currentUserAgent = req.get('user-agent') || 'unknown';

  // Initialize session fingerprints if new
  if (!session.nis2Fingerprint) {
    session.nis2Fingerprint = {
      ip: currentIP,
      userAgent: currentUserAgent,
      establishedAt: Date.now(),
    };
    next();
    return;
  }

  // Validate Fingerprint
  let violation = false;
  let reason = '';

  if (config.enforceIpBinding && session.nis2Fingerprint.ip !== currentIP) {
    violation = true;
    reason = `IP address mismatch: stored=${session.nis2Fingerprint.ip}, current=${currentIP}`;
  }

  if (config.enforceUaBinding && session.nis2Fingerprint.userAgent !== currentUserAgent) {
    violation = true;
    reason = `User-Agent mismatch: stored=${session.nis2Fingerprint.userAgent}, current=${currentUserAgent}`;
  }

  if (violation) {
    // Log security event
    const message = `Session hijacking detected: ${reason}`;
    console.warn(`[NIS2 Shield] ${message}`);

    // Notify via Webhook
    const notifier = getWebhookNotifier(webhookConfig);
    if (notifier) {
      notifier.notify({
        event: 'session_hijacking' as WebhookEventType,
        ip: currentIP,
        path: req.originalUrl,
        method: req.method,
        message,
        metadata: {
          userId: req.nis2?.userId,
          storedFingerprint: session.nis2Fingerprint,
        },
      });
    }

    // Destroy session and block request
    session.destroy((err: any) => {
      if (err) console.error('[NIS2 Shield] Error destroying hijacked session:', err);

      res.status(403).json({
        error: 'Session terminated due to security violation (Session Guard)',
        code: 'NIS2_SESSION_HIJACK',
      });
    });
  } else {
    next();
  }
}
