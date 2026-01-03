import { WebhookConfig } from '../config/nis2Config';

export class WebhookNotifier {
  constructor(private config: WebhookConfig) {}

  async notify(evenType: string, message: string, details?: any): Promise<void>;
  async notify(payload: {
    event: string;
    message: string;
    ip?: string;
    path?: string;
    method?: string;
    metadata?: any;
  }): Promise<void>;
  async notify(arg1: any, arg2?: any, arg3?: any): Promise<void> {
    let event: string;
    let message: string;
    let details: any = {};

    if (typeof arg1 === 'object') {
      event = arg1.event;
      message = arg1.message;
      details = { ...arg1 };
      delete details.event;
      delete details.message;
    } else {
      event = arg1;
      message = arg2;
      details = arg3 || {};
    }

    if (!this.config.enabled || this.config.endpoints.length === 0) return;

    const relevantEndpoints = this.config.endpoints.filter(
      (ep) => ep.events.includes('all') || ep.events.includes(event as any)
    );

    if (relevantEndpoints.length === 0) return;

    const formattedMessage = this.formatMessage(event, message, details);

    const promises = relevantEndpoints.map((ep) =>
      this.sendToEndpoint(ep, formattedMessage, details).catch((err) =>
        console.error(`[NIS2 Webhook Failed] ${ep.url}:`, err)
      )
    );

    // Fire and forget, but catch global rejections in background
    Promise.allSettled(promises);
  }

  private async sendToEndpoint(endpoint: any, text: string, details: any) {
    let body: any;

    if (endpoint.type === 'slack') {
      body = { text, attachments: [{ color: '#ff0000', fields: this.toSlackFields(details) }] };
    } else if (endpoint.type === 'teams') {
      body = {
        '@type': 'MessageCard',
        text: text,
        sections: [{ facts: this.toTeamsFacts(details) }],
      };
    } else if (endpoint.type === 'discord') {
      body = { content: text };
    } else {
      // Generic
      body = { event: 'NIS2_ALERT', message: text, details };
    }

    await fetch(endpoint.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private formatMessage(event: string, baseMessage: string, details: any): string {
    const icon = '🛡️ [NIS2 SHIELD]';
    return `${icon} [${event.toUpperCase()}] ${baseMessage} | ${JSON.stringify(details)}`;
  }

  private toSlackFields(details: any) {
    return Object.entries(details).map(([k, v]) => ({ title: k, value: String(v), short: true }));
  }

  private toTeamsFacts(details: any) {
    return Object.entries(details).map(([k, v]) => ({ name: k, value: String(v) }));
  }
}

// Singleton instance container
let instance: WebhookNotifier | null = null;

export const createWebhookNotifier = (config: WebhookConfig): WebhookNotifier => {
  instance = new WebhookNotifier(config);
  return instance;
};

export const getWebhookNotifier = (config?: WebhookConfig): WebhookNotifier | null => {
  if (!instance && config) {
    return createWebhookNotifier(config);
  }
  return instance;
};
