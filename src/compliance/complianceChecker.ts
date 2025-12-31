import { Nis2Config } from '../types';
import { ComplianceCheckResult } from './reportGenerator';

/**
 * Compliance Checker
 * Audits the configuration against NIS2 requirements
 */
export class ComplianceChecker {
    private config: Nis2Config;

    constructor(config: Nis2Config) {
        this.config = config;
    }

    check(): ComplianceCheckResult[] {
        const checks: ComplianceCheckResult[] = [];

        // 1. NIS2 Shield Enabled
        checks.push({
            id: 'nis2-enabled',
            description: 'NIS2 Shield Middleware Enabled',
            passed: this.config.enabled,
            details: this.config.enabled ? 'Enabled' : 'Disabled (Critical)',
            severity: 'critical'
        });

        // 2. Integrity Key (Art. 21.2.h)
        const hasIntegrityKey = !!this.config.integrityKey && this.config.integrityKey.length >= 32;
        checks.push({
            id: 'integrity-key',
            description: 'Log Integrity Key Configured (Art. 21.2.h)',
            passed: hasIntegrityKey,
            details: hasIntegrityKey ? 'Configured' : 'Missing or weak key',
            severity: 'critical'
        });

        // 3. Encryption Key (Art. 21.2.f)
        const hasEncryptionKey = !!this.config.encryptionKey && this.config.encryptionKey.length >= 32;
        checks.push({
            id: 'encryption-key',
            description: 'PII Encryption Key Configured (Art. 21.2.f)',
            passed: hasEncryptionKey,
            details: hasEncryptionKey ? 'Configured' : 'Missing or weak key',
            severity: 'critical'
        });

        // 4. Rate Limiting (Art. 21.2.e)
        const rateLimit = this.config.activeDefense?.rateLimit?.enabled;
        checks.push({
            id: 'active-defense-ratelimit',
            description: 'Rate Limiting / Active Defense (Art. 21.2.e)',
            passed: !!rateLimit,
            details: rateLimit ? 'Enabled' : 'Disabled',
            severity: 'warning'
        });

        // 5. Security Headers (Art. 21.2.d)
        const securityHeaders = this.config.securityHeaders?.enabled;
        checks.push({
            id: 'security-headers',
            description: 'Security Headers Enforced (Art. 21.2.d)',
            passed: !!securityHeaders,
            details: securityHeaders ? 'Enabled' : 'Disabled',
            severity: 'warning'
        });

        // 6. Forensic Logging (Art. 21.2.h)
        const logging = this.config.logging?.enabled;
        checks.push({
            id: 'forensic-logging',
            description: 'Forensic Logging & Auditing (Art. 21.2.h)',
            passed: !!logging,
            details: logging ? 'Enabled' : 'Disabled',
            severity: 'critical'
        });

        // 7. Session Guard (Art. 21.2.d - Access Control)
        const sessionGuard = this.config.activeDefense?.sessionGuard?.enabled;
        checks.push({
            id: 'session-guard',
            description: 'Session Hijacking Protection (Art. 21.2.d)',
            passed: !!sessionGuard,
            details: sessionGuard ? 'Enabled' : 'Disabled',
            severity: 'warning'
        });

        // 8. SIEM/Notifications (Art. 21.2.b - Incident Handling)
        const siem = ['splunk', 'datadog', 'qradar'].includes(this.config.logging?.output as string);
        const webhooks = !!this.config.webhooks?.url;
        checks.push({
            id: 'incident-response',
            description: 'Incident Response / SIEM Integration (Art. 21.2.b)',
            passed: siem || webhooks,
            details: siem ? 'SIEM Configured' : webhooks ? 'Webhooks Configured' : 'No external reporting configured',
            severity: 'warning'
        });

        return checks;
    }
}
