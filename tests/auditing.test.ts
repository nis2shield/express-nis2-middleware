import express, { Express } from 'express';
import request from 'supertest';
import { nis2Shield } from '../src/index';

describe('Auditing Middleware', () => {
    let app: Express;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        app = express();
        // Spy on console.log (default output)
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => { });
    });

    afterEach(() => {
        logSpy.mockRestore();
    });

    it('should log request and response metadata', async () => {
        app.use(nis2Shield({
            logging: { enabled: true, output: 'console' }
        }));

        app.get('/audit-test', (_req, res) => res.json({ status: 'ok' }));

        await request(app).get('/audit-test');

        expect(logSpy).toHaveBeenCalled();
        const logStr = logSpy.mock.calls[0][0];
        const log = JSON.parse(logStr);

        expect(log.component).toBe('NIS2-SHIELD-NODE');
        expect(log.request.method).toBe('GET');
        expect(log.request.url).toBe('/audit-test');
        expect(log.response.status).toBe(200);
        expect(log.response.duration_ms).toBeGreaterThanOrEqual(0);
        expect(log.timestamp).toBeDefined();
    });

    it('should anonymize IP addresses by default', async () => {
        app.use(nis2Shield());

        app.get('/ip-test', (_req, res) => res.send('ok'));

        // Simulate X-Forwarded-For
        await request(app)
            .get('/ip-test')
            .set('X-Forwarded-For', '192.168.1.50');

        const log = JSON.parse(logSpy.mock.calls[0][0]);
        // Should mask last octet: 192.168.1.0
        expect(log.request.ip).toBe('192.168.1.0');
    });

    it('should encrypt PII fields when key is provided', async () => {
        const key = Buffer.alloc(32, 'test-key-32-bytes-123456789012').toString('base64');

        app.use(nis2Shield({
            encryptionKey: key,
            logging: { encryptPII: true, piiFields: ['email'] }
        }));

        app.use((req: any, _res: any, next: any) => {
            // Simulate adding metadata that contains PII
            req.nis2.userId = 'user-123';
            next();
        });

        app.get('/pii-test', (_req, res) => res.send('ok'));

        await request(app).get('/pii-test');

        const log = JSON.parse(logSpy.mock.calls[0][0]);

        // User ID should be encrypted (contains ':') and not equal to original
        // User ID should be encrypted (contains ':') and not equal to original
        expect(log.user.id).toContain(':');
        expect(log.user.id).not.toBe('user-123');
    });

    it('should sign logs with HMAC when integrity key is provided', async () => {
        const integrityKey = 'secret-hmac-key';

        app.use(nis2Shield({
            integrityKey,
            logging: { enabled: true }
        }));

        app.get('/hmac-test', (_req, res) => res.send('ok'));

        await request(app).get('/hmac-test');

        const log = JSON.parse(logSpy.mock.calls[0][0]);

        expect(log.integrity_hash).toBeDefined();
        expect(log.integrity_hash).toHaveLength(64); // SHA-256 hex length
    });

    it('should use custom log handler if configured', async () => {
        const customHandler = jest.fn();

        app.use(nis2Shield({
            logging: {
                enabled: true,
                output: 'custom',
                customHandler
            }
        }));

        app.get('/custom-test', (_req, res) => res.send('ok'));

        await request(app).get('/custom-test');

        expect(customHandler).toHaveBeenCalled();
        const log = customHandler.mock.calls[0][0];
        expect(log.request.url).toBe('/custom-test');

        // Console log should NOT be called
        expect(logSpy).not.toHaveBeenCalled();
    });
});
