import { AuditLog, LoggingConfig } from '../types';

/**
 * Splunk HEC Transport
 * Sends logs to Splunk HTTP Event Collector
 */
export class SplunkTransport {
  private config: NonNullable<LoggingConfig['splunk']>;
  private buffer: any[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private processing: boolean = false;

  constructor(config: NonNullable<LoggingConfig['splunk']>) {
    this.config = config;

    // Setup batch processing
    const interval = config.batchInterval || 5000;
    this.flushInterval = setInterval(() => this.flush(), interval);
  }

  /**
   * Add log to buffer
   */
  log(entry: AuditLog): void {
    // Format for Splunk HEC
    const splunkEvent = {
      time: new Date(entry.timestamp).getTime() / 1000,
      host: entry.metadata?.hostname || 'express-middleware',
      source: this.config.source || 'nis2-shield',
      sourcetype: this.config.sourceType || '_json',
      index: this.config.index || 'main',
      event: entry,
    };

    this.buffer.push(splunkEvent);

    if (this.buffer.length >= (this.config.batchSize || 10)) {
      this.flush();
    }
  }

  /**
   * Flush buffer to Splunk
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.processing) return;

    this.processing = true;
    const batch = [...this.buffer];
    this.buffer = [];

    try {
      // HEC expects newline-delimited JSON for batch
      const body = batch.map((e) => JSON.stringify(e)).join('\n');

      const response = await fetch(`${this.config.hecUrl || ''}/services/collector`, {
        method: 'POST',
        headers: {
          Authorization: `Splunk ${this.config.token || ''}`,
        },
        body,
      });

      if (!response.ok) {
        console.error(`[NIS2 Shield] Splunk HEC failed: ${response.status} ${response.statusText}`);
        // Simple retry strategy: put back compatible chunk? No, drop to avoid memory leak for now.
      }
    } catch (error) {
      console.error('[NIS2 Shield] Error sending to Splunk:', error);
    } finally {
      this.processing = false;
    }
  }

  stop(): void {
    if (this.flushInterval) clearInterval(this.flushInterval);
    this.flush();
  }
}
