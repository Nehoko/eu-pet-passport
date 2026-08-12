# Security model

## Stored data and threats

App stores owner contact data, animal identity, and owner-transcribed health information. Main
threats: stolen credentials, cross-account access, CSRF, XSS, SQL injection, database theft, and
container escape.

## Controls

- One account type; no privileged web role.
- Every list, detail, write, emergency, and API request is scoped to signed-in email.
- Foreign object behaves as 404; form-supplied owner identity is ignored.
- PBKDF2-HMAC-SHA-256: 600,000 rounds, per-user 128-bit salt.
- 256-bit opaque session; database stores SHA-256 digest only.
- 30-minute idle and 8-hour absolute session expiry.
- `HttpOnly`, `SameSite=Strict`; `Secure` and `__Host-` prefix under HTTPS.
- CSRF token, exact-origin validation, cross-site Fetch Metadata rejection.
- Prepared SQL, field limits, 1 MB request cap, escaped HTML, strict CSP/security headers.
- Generic login error and per-account/IP in-memory throttle.
- Internal hash-chained mutation events and consistent SQLite backup.
- Distroless non-root image, read-only root, dropped capabilities under Docker Compose.

## Operator duties

- Terminate TLS and set exact `APP_ORIGIN` for internet use.
- Encrypt disks/backups and restrict volume access.
- Put persistent rate limiting at reverse proxy.
- Define GDPR basis, retention, export/deletion, breach, and support processes.
- Run restore drills, updates, vulnerability scans, and independent security review.

## Known gaps

- No email verification, MFA, password recovery, export, or account deletion yet.
- SQLite is not application-encrypted.
- Audit chain is tamper-evident, not externally anchored.
- Throttle resets on process restart.
- Server compromise exposes live data and sessions.
- Owner-entered medical information is not independently verified.
