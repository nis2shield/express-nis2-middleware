# @nis2shield/express-middleware 🛡️

[![npm version](https://img.shields.io/npm/v/@nis2shield/express-middleware.svg)](https://www.npmjs.com/package/@nis2shield/express-middleware)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Compliance](https://img.shields.io/badge/NIS2-Compliant-orange)](https://nis2shield.com)

**Enterprise-grade NIS2 Compliance Middleware for Express.js** - Forensic logging, active defense, and security audit in a single `app.use()`.

## Why this package?

Companies subject to NIS2 Directive need **demonstrable compliance**. This middleware provides the technical controls required by law:

1.  **Forensic Logging**: JSON logs signed with HMAC-SHA256, PII encryption (Art. 21.2.h)
2.  **Rate Limiting**: Token bucket algorithm to prevent DoS/Brute Force (Art. 21.2.e)
3.  **IP/Geo Blocking**: Block Tor exit nodes, countries, malicious IPs (Art. 21.2.a)
4.  **Session Guard**: Detect session hijacking via IP/User-Agent validation
5.  **Multi-SIEM**: Direct connectors for Splunk, Datadog, QRadar
6.  **Compliance CLI**: Audit your configuration with `npx check-nis2`

> **Part of the NIS2 Shield Ecosystem**: Use with [`nis2shield/infrastructure`](https://github.com/nis2shield/infrastructure) for a complete, audited full-stack implementation.

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  @nis2shield/react-guard                                    │
│  ├── SessionWatchdog (idle detection)                       │
│  ├── AuditBoundary (crash reports)                         │
│  └── → POST /api/nis2/telemetry/                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (NIS2 Adapter)                      │
│  **@nis2shield/express-middleware**                         │
│  ├── ForensicLogger (HMAC signed logs)                     │
│  ├── RateLimiter, SessionGuard, TorBlocker                 │
│  └── → SIEM (Elasticsearch, Splunk, QRadar, etc.)          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure                            │
│  nis2shield/infrastructure                                  │
│  ├── Centralized Logging (ELK/Splunk)                       │
│  └── Audited Deployment (Terraform/Helm)                    │
└─────────────────────────────────────────────────────────────┘
```

## ✨ Features (v0.3.0)

- 🔐 **Forensic Logging**: JSON structured logs with HMAC-SHA256 integrity & PII encryption.
- 🚀 **Active Defense**:
  - **Rate Limiting**: Token bucket algorithm.
  - **IP Blocking**: Block static IPs, Tor exit nodes, and Countries (GeoIP).
  - **Session Guard**: Session hijacking protection (IP/User-Agent).
- 🚨 **Multi-SIEM Support**: Direct connectors for **Splunk HEC**, **Datadog**, and **QRadar**.
- 🔔 **Notifications**: Webhook integration for security alerts (Slack/Teams).
- ✅ **Compliance Engine**: Built-in CLI `npx check-nis2` to audit your configuration.
- 🛡️ **Security Headers**: HSTS, CSP, X-Frame-Options, and more.

## Installation

```bash
npm install @nis2shield/express-middleware
```

## Quick Start

```typescript
import express from 'express';
import { nis2Shield } from '@nis2shield/express-middleware';

const app = express();

// Basic usage - enables all features with defaults
app.use(nis2Shield());

app.get('/', (req, res) => {
  res.json({ message: 'Protected by NIS2 Shield!' });
});

app.listen(3000);
```

## Configuration

```typescript
import { nis2Shield, Nis2Config } from '@nis2shield/express-middleware';

const config: Partial<Nis2Config> = {
  enabled: true,
  encryptionKey: process.env.NIS2_ENCRYPTION_KEY,
  integrityKey: process.env.NIS2_HMAC_KEY,
  
  logging: {
    enabled: true,
    anonymizeIP: true,
    encryptPII: true,
    piiFields: ['userId', 'email'],
  },
  
  activeDefense: {
    rateLimit: {
      enabled: true,
      windowMs: 60000, // 1 minute
      max: 100,        // 100 requests per window
    },
    blockTor: true,
  },
  
  securityHeaders: {
    enabled: true,
    hsts: true,
    csp: "default-src 'self'",
    xFrameOptions: 'DENY',
  },
};

app.use(nis2Shield(config));
```

## Environment Variables

```bash
NIS2_ENCRYPTION_KEY=your-base64-aes-256-key
NIS2_HMAC_KEY=your-secret-hmac-key
```

## Security Headers Applied

| Header | Default Value |
|--------|---------------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Restrictive policy |

## Log Format (JSON)

```json
{
  "timestamp": "2025-01-15T10:00:00.000Z",
  "module": "nis2_shield",
  "type": "audit_log",
  "request": {
    "method": "POST",
    "path": "/api/login",
    "ip": "203.0.113.xxx"
  },
  "response": {
    "status": 200,
    "duration_ms": 45
  },
  "integrity_hash": "a1b2c3d4..."
}
```

## 📖 Recipes

### Banking API with Strict Rate Limiting

```typescript
import express from 'express';
import { nis2Shield } from '@nis2shield/express-middleware';

const app = express();

app.use(nis2Shield({
  enabled: true,
  encryptionKey: process.env.NIS2_ENCRYPTION_KEY,
  integrityKey: process.env.NIS2_HMAC_KEY,
  
  activeDefense: {
    rateLimit: {
      enabled: true,
      windowMs: 60000,
      max: 30,  // Strict: 30 req/min for banking
    },
    blockTor: true,
    blockedCountries: ['KP', 'IR'],  // OFAC compliance
  },
  
  securityHeaders: {
    enabled: true,
    hsts: true,
    xFrameOptions: 'DENY',
  },
}));
```

### E-commerce with Slack Alerts

```typescript
import { nis2Shield, createWebhookNotifier } from '@nis2shield/express-middleware';

const webhookNotifier = createWebhookNotifier({
  url: 'https://hooks.slack.com/services/...',
  format: 'slack',
  events: ['rate_limit', 'session_hijack', 'blocked_ip'],
});

app.use(nis2Shield({
  enabled: true,
  webhooks: webhookNotifier,
  logging: {
    enabled: true,
    anonymizeIP: true,
    encryptPII: true,
  },
}));
```

### Microservice with Datadog SIEM

```typescript
import { nis2Shield } from '@nis2shield/express-middleware';

app.use(nis2Shield({
  enabled: true,
  siem: {
    type: 'datadog',
    apiKey: process.env.DD_API_KEY,
    site: 'datadoghq.eu',
  },
}));
```

## Related Projects

- [django-nis2-shield](https://pypi.org/project/django-nis2-shield/) - Python/Django
- [nis2-spring-shield](https://central.sonatype.com/artifact/com.nis2shield/nis2-spring-shield) - Java/Spring Boot
- [@nis2shield/react-guard](https://www.npmjs.com/package/@nis2shield/react-guard) - React/Frontend

## Release Process

Automated releases are handled via GitHub Actions.

1. **Create Tag**: Push a new tag (e.g., `v0.2.0`).
2. **GitHub Release**: Create a release in the GitHub UI.
3. **CI/CD**: The `npm-publish.yml` workflow triggers automatically:
    - Builds the project.
    - Runs tests.
    - Publishes to **npm** (using `NPM_TOKEN` secret).

---

## License

MIT License - See [LICENSE](LICENSE) for details.

## Links

- 🌐 [Website](https://nis2shield.com/express/)
- 📖 [Documentation](https://nis2shield.com/docs/)
- 🐛 [Issues](https://github.com/nis2shield/express-nis2-middleware/issues)
