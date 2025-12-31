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
│   │   └── activeDefenseMiddleware.ts # IP blocking, Tor detection
│   ├── utils/
│   │   ├── cryptoUtils.ts             # AES-256, HMAC-SHA256
│   │   ├── logFormatter.ts            # JSON structured logs
│   │   ├── ipUtils.ts                 # Anonymization, IP extraction
│   │   └── rateLimitStore.ts          # In-memory token bucket store
│   ├── config/
│   │   └── nis2Config.ts              # Configuration schema (Zod)
│   ├── types/
│   │   └── index.ts                   # TypeScript interfaces
│   └── index.ts                       # Main export
├── tests/
│   ├── auditing.test.ts
│   ├── activeDefense.test.ts
│   └── middleware.test.ts
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
- **Runtime**: Node.js 18+ (LTS)
- **Language**: TypeScript 5.x
- **Framework**: Express 4.x (+ compatibilità Express 5.x)
- **Rate Limiting**: Custom token bucket (no dipendenze esterne)
- **Crypto**: Node.js native `crypto` module
- **Validation**: Zod
- **Testing**: Jest + Supertest
- **Linting**: ESLint + Prettier
- **Build**: tsup (dual CJS/ESM)

---

## 🗺 Roadmap & Completamento

### Fase 1: Setup & Scaffolding ✅ COMPLETATA
L'obiettivo è avere la struttura base del progetto pronta.

- [x] **Project Skeleton**:
    - [x] `package.json` con metadata npm (name, version, keywords, etc.)
    - [x] `tsconfig.json` configurato per ESM + CommonJS dual export
    - [x] ESLint + Prettier configuration
    - [x] Jest setup con TypeScript
- [x] **GitHub Setup**:
    - [x] Repository `nis2shield/express-nis2-middleware`
    - [x] CI workflow (test on push)
    - [x] Publish workflow (npm publish on release)
- [x] **Basic Structure**:
    - [x] Export pattern da `src/index.ts`
    - [x] Types definitions in `src/types/`

### Fase 2: Core Middleware - Auditing (The Truth) ✅ COMPLETATA
Forensic logging conforme NIS2 Art. 21.

- [x] **AuditingMiddleware**:
    - [x] Capture request (method, path, headers, IP, User-Agent)
    - [x] Capture response (status code, duration)
    - [x] Wrap in structured JSON log
- [x] **Log Integrity**:
    - [x] HMAC-SHA256 signing di ogni log entry
    - [x] Configurable integrity key
- [x] **PII Protection**:
    - [x] IP Anonymization (mask last octet)
    - [x] AES-256 encryption for sensitive fields (user ID, email)
    - [x] Configurable fields to encrypt
- [x] **Log Output**:
    - [x] Console (development)
    - [ ] File (production) - *Stub implementato, fallback a console*
    - [x] Custom transport (SIEM integration)

### Fase 3: Active Defense ✅ COMPLETATA
Protezione proattiva contro attacchi.

- [x] **Rate Limiting**:
    - [x] Token bucket algorithm (in-memory)
    - [x] Configurable: requests per window, window size
    - [x] Per-IP or per-user limiting
    - [x] Custom response on limit exceeded
- [x] **IP Blocking**:
    - [x] Block list (static IPs)
    - [x] Tor exit node detection (simulata per MVP)
    - [ ] GeoIP blocking (future v0.2.0)
- [x] **Security Headers**:
    - [x] HSTS (Strict-Transport-Security)
    - [x] X-Content-Type-Options: nosniff
    - [x] X-Frame-Options: DENY
    - [x] Content-Security-Policy (configurable)
    - [x] Referrer-Policy
    - [x] Permissions-Policy

### Fase 4: Configuration & DX ✅ COMPLETATA
Developer Experience di prima classe.

- [x] **Configuration Schema**:
    - [x] Zod schema for type-safe config validation
    - [x] Sensible defaults
    - [x] `defineNis2Config` helper for autocompletion
- [x] **TypeScript Support**:
    - [x] Full type exports
    - [x] Augmented Express types (req.nis2)
- [x] **Error Handling**:
    - [x] Graceful degradation if config invalid
    - [x] Fail-open in rate limiter on errors

### Fase 5: Publishing & Documentation ✅ COMPLETATA
Rilascio pubblico su npm.

- [x] **npm Publishing**:
    - [x] Scope: `@nis2shield/express-middleware`
    - [x] Semantic versioning (v0.1.0)
    - [x] GitHub Actions automation
- [x] **Documentation**:
    - [x] README with badges, install, quick start
    - [x] Configuration examples
    - [x] Log format specification
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

Il formato JSON è identico a Django e Spring per garantire dashboard uniformi.

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

## 🔗 Sinergie con Altri Progetti NIS2 Shield

| Componente | Riutilizzabile? | Note |
|------------|-----------------|------|
| CryptoUtils (AES-256) | ✅ Sì | Stesso algoritmo, Node.js native crypto |
| HMAC-SHA256 | ✅ Sì | Identico |
| Types/Interfaces | ✅ Parziale | Adattate per server-side |
| IP Utils | ❌ No | Server-side only |
| Rate Limiter | ❌ No | Custom implementation |

---

## ⏱ Timeline Completata

| Fase | Tempo Stimato | Status |
|------|---------------|--------|
| Fase 1: Setup | 2 giorni | ✅ Done |
| Fase 2: Auditing | 3 giorni | ✅ Done |
| Fase 3: Active Defense | 3 giorni | ✅ Done |
| Fase 4: Config & DX | 2 giorni | ✅ Done |
| Fase 5: Publishing | 1 giorno | ✅ Done |
| **TOTALE** | **~11 giorni** | **✅ Completato** |

---

## 🚀 Roadmap v0.2.0+

### 📁 File Output with Rotation ✅ COMPLETED
- [x] Implement proper file output in `outputLog()` function
- [x] Create `FileTransport` class with rotation support
- [x] Add rotation configuration (size-based: `maxFileSize`, `maxFiles`)
- [x] Fallback to console on write errors

**Implementation:** `src/utils/fileTransport.ts`

**Implementation approach:**
```typescript
import { appendFile } from 'fs/promises';
// Or integrate pino-pretty for development, pino for production
```

---

### 🧅 Real Tor Exit Node Detection ✅ COMPLETED
- [x] Fetch real Tor exit node list from TorProject API
- [x] Cache list with periodic refresh (every 6 hours)
- [x] Sync and async check methods for performance
- [x] Export `TorDetector`, `getTorDetector`, `warmTorCache`

**Implementation:** `src/utils/torDetector.ts`

---

### 🌍 GeoIP Blocking
- [ ] Integrate MaxMind GeoLite2 database
- [ ] Add `blockedCountries` config option
- [ ] Support allow-list mode (only allow specific countries)

**Implementation approach:**
```bash
npm install maxmind
# Download GeoLite2-City.mmdb from MaxMind
```

---

### 🔄 Other Improvements
- [ ] Redis store for rate limiting (distributed deployments)
- [ ] Webhook notifications on security events
- [ ] Dashboard integration examples (Grafana, Kibana)
- [ ] Express 5.x official testing

---

*Ultimo aggiornamento: 30 Dicembre 2025*
*Versione: v0.1.0*
