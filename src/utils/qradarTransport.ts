import { AuditLog, LoggingConfig } from '../types';
import * as net from 'net';
import * as dgram from 'dgram';

/**
 * QRadar / Syslog Transport
 * Sends logs via TCP or UDP, optionally in CEF format
 */
export class QRadarTransport {
    private config: NonNullable<LoggingConfig['qradar']>;
    private udpClient: dgram.Socket | null = null;

    constructor(config: NonNullable<LoggingConfig['qradar']>) {
        this.config = config;
    }

    async log(entry: AuditLog): Promise<void> {
        const message = this.config.transformToCEF
            ? this.formatCEF(entry)
            : JSON.stringify(entry);

        if (this.config.protocol === 'udp') {
            this.sendUdp(message);
        } else {
            this.sendTcp(message);
        }
    }

    private formatCEF(entry: AuditLog): string {
        // CEF:Version|Device Vendor|Device Product|Device Version|Device Event Class ID|Name|Severity|[Extension]
        const version = '0';
        const vendor = 'NIS2Shield';
        const product = 'ExpressMiddleware';
        const devVersion = process.env.npm_package_version || '0.3.0';
        const eventClass = entry.type;
        const name = entry.type === 'audit_log' ? 'Access Audit' : 'Security Event';
        const severity = entry.level === 'ERROR' ? '7' : entry.level === 'WARN' ? '4' : '1';

        // Extension key-value pairs
        const extension = [
            `src=${entry.request.ip}`,
            `requestMethod=${entry.request.method}`,
            `request=${entry.request.path}`,
            `msg=${JSON.stringify(entry)}`
        ].join(' ');

        return `CEF:${version}|${vendor}|${product}|${devVersion}|${eventClass}|${name}|${severity}|${extension}`;
    }

    private sendUdp(message: string): void {
        if (!this.udpClient) this.udpClient = dgram.createSocket('udp4');
        const buffer = Buffer.from(message);
        this.udpClient.send(buffer, 0, buffer.length, this.config.port, this.config.host, (err) => {
            if (err) console.error('[NIS2 Shield] QRadar UDP error:', err);
        });
    }

    private sendTcp(message: string): void {
        const client = new net.Socket();
        client.connect(this.config.port, this.config.host, () => {
            client.write(message + '\n');
            client.end();
            client.destroy(); // Close after write (short-lived for simplicity, persistent connection is better for high throughput)
        });
        client.on('error', (err) => {
            console.error('[NIS2 Shield] QRadar TCP error:', err);
        });
    }
}
