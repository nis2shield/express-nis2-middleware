import express, { Express } from 'express';
import request from 'supertest';
import { nis2Shield } from '../src/index';

describe('Active Defense Middleware', () => {
    let app: Express;

    beforeEach(() => {
        app = express();
    });

    describe('Rate Limiting', () => {
        it('should limit requests when threshold is exceeded', async () => {
            app.use(nis2Shield({
                activeDefense: {
                    rateLimit: {
                        enabled: true,
                        windowMs: 1000,
                        max: 2 // Max 2 requests
                    }
                }
            }));

            app.get('/', (_req, res) => res.json({ status: 'ok' }));

            // 1st request - OK
            const res1 = await request(app).get('/');
            expect(res1.status).toBe(200);
            expect(res1.headers['x-ratelimit-remaining']).toBe('1');

            // 2nd request - OK
            const res2 = await request(app).get('/');
            expect(res2.status).toBe(200);
            expect(res2.headers['x-ratelimit-remaining']).toBe('0');

            // 3rd request - Blocked
            const res3 = await request(app).get('/');
            expect(res3.status).toBe(429);
            expect(res3.body.error).toBe('Too Many Requests');
        });

        it('should reset limits after window expires', async () => {
            // Use a very short window for testing
            app.use(nis2Shield({
                activeDefense: {
                    rateLimit: {
                        enabled: true,
                        windowMs: 100, // 100ms
                        max: 1
                    }
                }
            }));

            app.get('/', (_req, res) => res.json({ status: 'ok' }));

            // 1st request - OK
            await request(app).get('/').expect(200);

            // 2nd request - Blocked (Immediate)
            await request(app).get('/').expect(429);

            // Wait for window to expire
            await new Promise(r => setTimeout(r, 150));

            // 3rd request - OK (Window reset)
            await request(app).get('/').expect(200);
        });

        it('should allow configuring custom key generator', async () => {
            app.use(nis2Shield({
                activeDefense: {
                    rateLimit: {
                        enabled: true,
                        windowMs: 60000,
                        max: 1,
                        keyGenerator: (req) => req.headers['x-api-key'] as string || 'default'
                    }
                }
            }));

            app.get('/', (_req, res) => res.json({ status: 'ok' }));

            // User A (Key 1) - OK
            await request(app).get('/').set('X-Api-Key', 'key1').expect(200);
            // User A (Key 1) - Blocked
            await request(app).get('/').set('X-Api-Key', 'key1').expect(429);

            // User B (Key 2) - OK (Different bucket)
            await request(app).get('/').set('X-Api-Key', 'key2').expect(200);
        });
    });

    describe('Tor Blocking', () => {
        it('should block requests from known Tor exit nodes', async () => {
            app.use(nis2Shield({
                activeDefense: {
                    blockTor: true
                }
            }));

            app.get('/', (_req, res) => res.send('ok'));

            // Normal IP - OK
            await request(app).get('/').expect(200);

            // Simulated Tor IP (hardcoded in ActiveDefenseMiddleware for MVP)
            // Note: IpUtils will read X-Forwarded-For if we assume proxy
            // But in supertest connection address is used unless we mock properly

            // We will rely on getting IP from the connection or mock it
            // Let's create an app that mocks the IP setter if possible or just rely on X-Forwarded-For if index.ts logic supports it (it does via getClientIP)

            await request(app)
                .get('/')
                .set('X-Forwarded-For', '6.6.6.6') // This is the mock Tor IP
                .expect(403)
                .expect((res) => {
                    expect(res.body.message).toContain('Tor exit nodes are not allowed');
                });
        });
    });

    describe('IP Blocking', () => {
        it('should block manual blocklisted IPs', async () => {
            app.use(nis2Shield({
                activeDefense: {
                    blockedIPs: ['1.2.3.4']
                }
            }));

            app.get('/', (_req, res) => res.send('ok'));

            // Blocked IP
            await request(app)
                .get('/')
                .set('X-Forwarded-For', '1.2.3.4')
                .expect(403)
                .expect((res) => {
                    expect(res.body.message).toContain('IP address is blocked');
                });

            // Allowed IP
            await request(app)
                .get('/')
                .set('X-Forwarded-For', '5.5.5.5')
                .expect(200);
        });
    });
});
