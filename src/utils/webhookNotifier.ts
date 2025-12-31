/**
 * Webhook Notifier for Security Events
 * Sends notifications to external webhooks when security events occur
 * @module @nis2shield/express-middleware
 */

import { WebhookConfig, WebhookEventType, WebhookPayload } from '../types';

/**
 * WebhookNotifier sends security event notifications to external webhooks.
 * 
 * @example
 * ```typescript
 * import { WebhookNotifier } from '@nis2shield/express-middleware';
 * 
 * const notifier = new WebhookNotifier({
 *   url: 'https://hooks.slack.com/...',
 *   events: ['rate_limit', 'blocked_ip']
 * });
 * 
 * // Called automatically by middleware, or manually:
 * await notifier.notify({
 *   event: 'rate_limit',
 *   ip: '192.168.1.100',
 *   path: '/api/login',
 *   method: 'POST',
 *   message: 'Rate limit exceeded'
 * });
 * ```
 */
export class WebhookNotifier {
    private config: Required<Omit<WebhookConfig, 'headers'>> & { headers?: Record<string, string> };
    private queue: WebhookPayload[] = [];
    private processing: boolean = false;

    constructor(config: WebhookConfig) {
        this.config = {
            url: config.url,
            events: config.events || ['rate_limit', 'blocked_ip', 'tor_blocked', 'geo_blocked'],
            headers: config.headers,
            retries: config.retries ?? 3,
            timeout: config.timeout ?? 5000,
        };
    }

    /**
     * Send a notification (non-blocking, queued)
     */
    notify(payload: Omit<WebhookPayload, 'timestamp'>): void {
        // Check if event type is enabled
        if (!this.config.events.includes(payload.event)) {
            return;
        }

        const fullPayload: WebhookPayload = {
            ...payload,
            timestamp: new Date().toISOString(),
        };

        this.queue.push(fullPayload);
        this.processQueue();
    }

    /**
     * Process queued notifications
     */
    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0) {
            const payload = this.queue.shift();
            if (payload) {
                await this.sendWithRetry(payload);
            }
        }

        this.processing = false;
    }

    /**
     * Send with retry logic
     */
    private async sendWithRetry(payload: WebhookPayload): Promise<boolean> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.config.retries; attempt++) {
            try {
                await this.send(payload);
                return true;
            } catch (error) {
                lastError = error as Error;

                // Wait before retry (exponential backoff)
                if (attempt < this.config.retries) {
                    await this.sleep(Math.min(1000 * Math.pow(2, attempt - 1), 10000));
                }
            }
        }

        console.error(`[NIS2 Shield] Webhook failed after ${this.config.retries} attempts:`, lastError?.message);
        return false;
    }

    /**
     * Send the actual HTTP request
     */
    private async send(payload: WebhookPayload): Promise<void> {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(this.config.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'NIS2Shield-WebhookNotifier/1.0',
                    ...this.config.headers,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Sleep helper
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get pending queue size
     */
    getPendingCount(): number {
        return this.queue.length;
    }

    /**
     * Check if notifier is processing
     */
    isProcessing(): boolean {
        return this.processing;
    }
}

// Global notifier instance cache
let defaultNotifier: WebhookNotifier | null = null;

/**
 * Get or create a WebhookNotifier instance
 */
export function getWebhookNotifier(config?: WebhookConfig): WebhookNotifier | null {
    if (config && !defaultNotifier) {
        defaultNotifier = new WebhookNotifier(config);
    }
    return defaultNotifier;
}

/**
 * Create a webhook notifier for a specific config
 */
export function createWebhookNotifier(config: WebhookConfig): WebhookNotifier {
    return new WebhookNotifier(config);
}
