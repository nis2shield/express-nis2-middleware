import { SiemConfig } from '../config/nis2Config';

export interface ISiemTransport {
    send(logEntry: Record<string, any>): Promise<void>;
}

export class SiemTransportManager {
    private transports: ISiemTransport[] = [];

    constructor(config: SiemConfig) {
        if (!config.enabled || !config.providers) return;

        if (config.providers.splunk?.enabled) {
            this.transports.push(new SplunkTransport(config.providers.splunk));
        }

        if (config.providers.datadog?.enabled) {
            this.transports.push(new DatadogTransport(config.providers.datadog));
        }

        if (config.providers.webhook?.enabled) {
            this.transports.push(new GenericWebhookTransport(config.providers.webhook));
        }
    }

    async broadcast(logEntry: Record<string, any>): Promise<void> {
        const promises = this.transports.map((t) =>
            t.send(logEntry).catch((err) => {
                // Fail silently or log to stderr to avoid crashing request
                console.error('[NIS2 SIEM Error]', err);
            }),
        );
        await Promise.allSettled(promises);
    }
}

class SplunkTransport implements ISiemTransport {
    constructor(private config: NonNullable<NonNullable<SiemConfig['providers']>['splunk']>) { }

    async send(logEntry: Record<string, any>): Promise<void> {
        if (!this.config.hecUrl || !this.config.token) return;

        const payload = {
            time: Date.now() / 1000,
            host: logEntry.hostname || 'express-app',
            source: this.config.source,
            sourcetype: this.config.sourceType,
            index: this.config.index,
            event: logEntry,
        };

        await fetch(this.config.hecUrl, {
            method: 'POST',
            headers: {
                Authorization: `Splunk ${this.config.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    }
}

class DatadogTransport implements ISiemTransport {
    constructor(private config: NonNullable<NonNullable<SiemConfig['providers']>['datadog']>) { } // Fixed type access

    async send(logEntry: Record<string, any>): Promise<void> {
        if (!this.config.apiKey) return;

        const url = `https://http-intake.logs.${this.config.site}/v1/input`;

        const payload = {
            ...logEntry,
            ddsource: 'nis2-express',
            ddtags: (this.config.tags || []).join(','),
            service: this.config.service
        };

        await fetch(url, {
            method: 'POST',
            headers: {
                'DD-API-KEY': this.config.apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
    }
}

class GenericWebhookTransport implements ISiemTransport {
    constructor(private config: NonNullable<NonNullable<SiemConfig['providers']>['webhook']>) { }

    async send(logEntry: Record<string, any>): Promise<void> {
        if (!this.config.url) return;

        await fetch(this.config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.config.headers || {})
            },
            body: JSON.stringify(logEntry)
        });
    }
}
