import { LoggingConfig } from '../types';
import { SplunkTransport } from './splunkTransport';
import { DatadogTransport } from './datadogTransport';
import { QRadarTransport } from './qradarTransport';

// Singleton cache
let splunkInstance: SplunkTransport | null = null;
let datadogInstance: DatadogTransport | null = null;
let qradarInstance: QRadarTransport | null = null;

export class TransportFactory {
    static getTransport(config: LoggingConfig): { log: (entry: any) => void | Promise<void> } | null {
        switch (config.output) {
            case 'splunk':
                if (config.splunk) {
                    if (!splunkInstance) splunkInstance = new SplunkTransport(config.splunk);
                    return splunkInstance;
                }
                break;
            case 'datadog':
                if (config.datadog) {
                    if (!datadogInstance) datadogInstance = new DatadogTransport(config.datadog);
                    return datadogInstance;
                }
                break;
            case 'qradar':
                if (config.qradar) {
                    if (!qradarInstance) qradarInstance = new QRadarTransport(config.qradar);
                    return qradarInstance;
                }
                break;
        }
        return null;
    }
}
