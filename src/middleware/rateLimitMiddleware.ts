/**
 * Rate Limiting Middleware
 * @module @nis2shield/express-middleware
 */

import { Response, NextFunction } from 'express';
import { Nis2Request, RateLimitConfig, RateLimiterStore } from '../types';
import { getClientIP } from '../utils/ipUtils';

export async function handleRateLimit(
  req: Nis2Request,
  res: Response,
  next: NextFunction,
  config: RateLimitConfig,
  store: RateLimiterStore
): Promise<void> {
  if (!config.enabled) {
    return next();
  }

  // Identify client
  const key = config.keyGenerator ? config.keyGenerator(req) : getClientIP(req);

  try {
    const { count, resetTime } = await store.increment(key);

    // Set standard RateLimit headers
    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

    // Check limit
    if (count > config.max) {
      if (req.nis2) {
        req.nis2.rateLimited = true;
      }

      if (config.handler) {
        config.handler(req, res);
      } else {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
        });
      }
      return;
    }

    next();
  } catch (error) {
    console.error('[NIS2 Shield] Rate limit error:', error);
    // Fail open if rate limiter errors
    next();
  }
}
