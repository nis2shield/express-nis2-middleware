# Express NIS2 Middleware - Project Plan

## 🎯 Obiettivo
Creare un middleware Express.js che porti la conformità NIS2 nel mondo Node.js. L'obiettivo è fornire una soluzione **"plug-and-play"** che renda conforme un'app Express semplicemente aggiungendo `app.use(nis2Shield())`.

## 🏗 Architettura

Il progetto sarà strutturato come un **npm package** TypeScript-first.

```
@nis2shield/express-middleware/
├── src/
│   ├── middleware/
│   │   ├── auditingMiddleware.ts      # Forensic logging
│   │   ├── rateLimitMiddleware.ts     # Token bucket rate limiting
│   │   ├── activeDefenseMiddleware.ts # IP blocking, Tor detection
│   │   └── securityHeadersMiddleware.ts
│   ├── utils/
│   │   ├── cryptoUtils.ts             # AES-256, HMAC-SHA256
│   │   ├── logFormatter.ts            # JSON structured logs
│   │   └── ipUtils.ts                 # Anonymization, Tor detection
│   ├── config/
│   │   └── nis2Config.ts              # Configuration schema
│   ├── types/
│   │   └── index.ts                   # TypeScript interfaces
│   └── index.ts                       # Main export
├── tests/
│   ├── auditing.test.ts
│   ├── rateLimit.test.ts
│   └── crypto.test.ts
├── package.json
├── tsconfig.json
├── jest.config.js
├── .eslintrc.js
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── publish.yml
└── README.md
```

### Stack Tecnologico
- **Runtime**: Node.js 20+ (LTS)
- **Language**: TypeScript 5.x
- **Framework**: Express 4.x (+ compatibilità Fastify via adapter)
- **Rate Limiting**: Custom token bucket (no dipendenze esterne)
- **Crypto**: Node.js native `crypto` module
- **Testing**: Jest + Supertest
- **Linting**: ESLint + Prettier

---

## 🗺 Roadmap & To-Do List

### Fase 1: Setup & Scaffolding
L'obiettivo è avere la struttura base del progetto pronta.

- [ ] **Project Skeleton**:
    - [ ] `package.json` con metadata npm (name, version, keywords, etc.)
    - [ ] `tsconfig.json` configurato per ESM + CommonJS dual export
    - [ ] ESLint + Prettier configuration
    - [ ] Jest setup con TypeScript
- [ ] **GitHub Setup**:
    - [ ] Repository `nis2shield/express-nis2-middleware`
    - [ ] CI workflow (test on push)
    - [ ] Publish workflow (npm publish on release)
- [ ] **Basic Structure**:
    - [ ] Export pattern da `src/index.ts`
    - [ ] Types definitions in `src/types/`

### Fase 2: Core Middleware - Auditing (The Truth)
Forensic logging conforme NIS2 Art. 21.

- [ ] **AuditingMiddleware**:
    - [ ] Capture request (method, path, headers, IP, User-Agent)
    - [ ] Capture response (status code, duration)
    - [ ] Wrap in structured JSON log
- [ ] **Log Integrity**:
    - [ ] HMAC-SHA256 signing di ogni log entry
    - [ ] Configurable integrity key
- [ ] **PII Protection**:
    - [ ] IP Anonymization (mask last octet)
    - [ ] AES-256 encryption for sensitive fields (user ID, email)
    - [ ] Configurable fields to encrypt
- [ ] **Log Output**:
    - [ ] Console (development)
    - [ ] File (production)
    - [ ] Custom transport (SIEM integration)

### Fase 3: Active Defense
Protezione proattiva contro attacchi.

- [ ] **Rate Limiting**:
    - [ ] Token bucket algorithm (in-memory)
    - [ ] Configurable: requests per window, window size
    - [ ] Per-IP or per-user limiting
    - [ ] Custom response on limit exceeded
- [ ] **IP Blocking**:
    - [ ] Block list (static IPs)
    - [ ] Tor exit node detection (configurable)
    - [ ] GeoIP blocking (future)
- [ ] **Security Headers**:
    - [ ] HSTS (Strict-Transport-Security)
    - [ ] X-Content-Type-Options: nosniff
    - [ ] X-Frame-Options: DENY
    - [ ] Content-Security-Policy (configurable)
    - [ ] Referrer-Policy
    - [ ] Permissions-Policy

### Fase 4: Configuration & DX
Developer Experience di prima classe.

- [ ] **Configuration Schema**:
    - [ ] Zod schema for type-safe config validation
    - [ ] Environment variables support
    - [ ] Sensible defaults
- [ ] **TypeScript Support**:
    - [ ] Full type exports
    - [ ] Augmented Express types (req.nis2)
- [ ] **Error Handling**:
    - [ ] Graceful degradation if config invalid
    - [ ] Clear error messages

### Fase 5: Publishing & Documentation
Rilascio pubblico su npm.

- [ ] **npm Publishing**:
    - [ ] Scope: `@nis2shield/express-middleware`
    - [ ] Semantic versioning
    - [ ] Changelog automation
- [ ] **Documentation**:
    - [ ] README with badges, install, quick start
    - [ ] API reference
    - [ ] Examples folder
- [ ] **Website**:
    - [ ] Page su nis2shield.com/express/
    - [ ] Link in homepage

---

## 💻 Esempio Utilizzo Finale

```typescript
import express from 'express';
import { nis2Shield, Nis2Config } from '@nis2shield/express-middleware';

const app = express();

// Option 1: Quick setup with defaults
app.use(nis2Shield());

// Option 2: Full configuration
const config: Nis2Config = {
  enabled: true,
  encryptionKey: process.env.NIS2_ENCRYPTION_KEY!,
  integrityKey: process.env.NIS2_HMAC_KEY!,
  
  logging: {
    enabled: true,
    anonymizeIP: true,
    encryptPII: true,
    piiFields: ['userId', 'email'],
    output: 'console', // 'console' | 'file' | 'custom'
  },
  
  activeDefense: {
    rateLimit: {
      enabled: true,
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 requests per window
    },
    blockTor: true,
    blockedIPs: [],
  },
  
  securityHeaders: {
    enabled: true,
    hsts: true,
    csp: "default-src 'self'",
  },
};

app.use(nis2Shield(config));

// Your routes
app.get('/api/users', (req, res) => {
  // req.nis2 available with shield context
  res.json({ users: [] });
});

app.listen(3000);
```

---

## 📝 Convenzioni Log (Interoperabilità)

Il formato JSON deve essere identico a Django e Spring per garantire dashboard uniformi.

```json
{
  "timestamp": "2025-01-15T10:00:00.000Z",
  "app_name": "express-backend",
  "level": "INFO",
  "module": "nis2_shield",
  "type": "audit_log",
  "request": {
    "method": "POST",
    "path": "/api/v1/login",
    "ip": "203.0.113.xxx",
    "user_agent": "Mozilla/5.0..."
  },
  "response": {
    "status": 200,
    "duration_ms": 45
  },
  "user_id": "[ENCRYPTED]...",
  "integrity_hash": "a1b2c3d4e5f6..."
}
```

---

## 🔗 Sinergie con React Guard

Riutilizzo massimo da `@nis2shield/react-guard`:

| Componente | Riutilizzabile? | Note |
|------------|-----------------|------|
| CryptoUtils (AES-256) | ✅ Sì | Stesso algoritmo, Node.js native crypto |
| HMAC-SHA256 | ✅ Sì | Identico |
| Types/Interfaces | ✅ Parziale | Adattare per server-side |
| IP Utils | ❌ No | Server-side only |
| Rate Limiter | ❌ No | Different implementation |

---

## ⏱ Timeline Stimata

| Fase | Tempo | Status |
|------|-------|--------|
| Fase 1: Setup | 2 giorni | ⏳ To Do |
| Fase 2: Auditing | 3 giorni | ⏳ To Do |
| Fase 3: Active Defense | 3 giorni | ⏳ To Do |
| Fase 4: Config & DX | 2 giorni | ⏳ To Do |
| Fase 5: Publishing | 1 giorno | ⏳ To Do |
| **TOTALE** | **~2 settimane** | |

---

*Ultimo aggiornamento: 30 Dicembre 2025*
