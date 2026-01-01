# Changelog

All notable changes to this project will be documented in this file.

## [0.3.0] - 2026-01-01

### Added
- **Multi-SIEM Support**: Added `SplunkTransport` (HEC) and `DatadogTransport` for direct log shipping.
- **Session Guard**: New middleware for detecting session hijacking via IP/User-Agent fingerprint validation.
- **Webhooks**: Real-time notifications for security events (Slack, Microsoft Teams, Discord, Generic Webhook).
- **Configuration**: Extended `Nis2Config` with `siem`, `sessionGuard`, and `webhooks` sections.

### Changed
- **Log Format**: `outputLog` now supports broadcasting to multiple SIEMs simultaneously.
- **Documentation**: Updated README with v0.3.0 features.

## [0.1.0] - 2025-12-30

### Added
- Initial release of NIS2 Compliance Middleware.
- Forensic Logging with HMAC signing.
- Rate Limiting (Token Bucket).
- Tor Exit Node Blocking.
- Security Headers (HSTS, CSP).
