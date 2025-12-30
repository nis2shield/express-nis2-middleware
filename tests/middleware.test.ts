import express, { Express } from 'express';
import request from 'supertest';
import { nis2Shield } from '../src/index';

describe('NIS2 Shield Middleware', () => {
    let app: Express;

    beforeEach(() => {
        app = express();
    });

    describe('Basic functionality', () => {
        it('should allow requests to pass through when enabled', async () => {
            app.use(nis2Shield({ enabled: true }));
            app.get('/test', (_req, res) => res.json({ success: true }));

            const response = await request(app).get('/test');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ success: true });
        });

        it('should allow requests when disabled', async () => {
            app.use(nis2Shield({ enabled: false }));
            app.get('/test', (_req, res) => res.json({ success: true }));

            const response = await request(app).get('/test');

            expect(response.status).toBe(200);
        });

        it('should work with default config', async () => {
            app.use(nis2Shield());
            app.get('/test', (_req, res) => res.json({ success: true }));

            const response = await request(app).get('/test');

            expect(response.status).toBe(200);
        });
    });

    describe('Security Headers', () => {
        beforeEach(() => {
            app.use(nis2Shield({
                enabled: true,
                securityHeaders: { enabled: true }
            }));
            app.get('/test', (_req, res) => res.json({ success: true }));
        });

        it('should set X-Content-Type-Options header', async () => {
            const response = await request(app).get('/test');

            expect(response.headers['x-content-type-options']).toBe('nosniff');
        });

        it('should set X-Frame-Options header', async () => {
            const response = await request(app).get('/test');

            expect(response.headers['x-frame-options']).toBe('DENY');
        });

        it('should set Strict-Transport-Security header', async () => {
            const response = await request(app).get('/test');

            expect(response.headers['strict-transport-security']).toContain('max-age=');
        });

        it('should set Referrer-Policy header', async () => {
            const response = await request(app).get('/test');

            expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
        });

        it('should set Permissions-Policy header', async () => {
            const response = await request(app).get('/test');

            expect(response.headers['permissions-policy']).toBeDefined();
        });
    });

    describe('Configuration', () => {
        it('should disable security headers when configured', async () => {
            app.use(nis2Shield({
                enabled: true,
                securityHeaders: { enabled: false }
            }));
            app.get('/test', (_req, res) => res.json({ success: true }));

            const response = await request(app).get('/test');

            // When disabled, default Express behavior (no HSTS)
            expect(response.headers['strict-transport-security']).toBeUndefined();
        });

        it('should use custom CSP when provided', async () => {
            app.use(nis2Shield({
                enabled: true,
                securityHeaders: {
                    enabled: true,
                    csp: "default-src 'self'"
                }
            }));
            app.get('/test', (_req, res) => res.json({ success: true }));

            const response = await request(app).get('/test');

            expect(response.headers['content-security-policy']).toBe("default-src 'self'");
        });
    });
});
