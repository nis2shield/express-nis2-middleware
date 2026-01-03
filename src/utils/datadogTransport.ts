import { AuditLog, LoggingConfig } from '../types';

/**
 * Datadog Logs Transport
 */
export class DatadogTransport {
  private config: NonNullable<LoggingConfig['datadog']>;
  private url: string;

  constructor(config: NonNullable<LoggingConfig['datadog']>) {
    this.config = config;
    const site = config.site || 'datadoghq.com';
    this.url = `https://http-intake.logs.${site}/api/v2/logs`;
  }

  async log(entry: AuditLog): Promise<void> {
    try {
      const tags = this.config.ddtags ? `${this.config.ddtags},env:production` : 'env:production';

      const payload = {
        ddsource: this.config.ddsource || 'nis2-shield',
        ddtags: tags,
        service: this.config.service || 'express-app',
        hostname: (entry.metadata?.hostname as string) || 'unknown',
        message: JSON.stringify(entry),
        status: entry.level === 'ERROR' ? 'error' : 'info',
        ...entry,
      };

      // Fire and forget (don't await to block response)
      fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.config.apiKey || '',
        },
        body: JSON.stringify(payload),
      })
        .then((res) => {
          if (!res.ok) console.error(`[NIS2 Shield] Datadog log failed: ${res.status}`);
        })
        .catch((err) => {
          console.error('[NIS2 Shield] Datadog transport error:', err);
        });
    } catch (error) {
      console.error('[NIS2 Shield] Error preparing Datadog log:', error);
    }
  }
}
