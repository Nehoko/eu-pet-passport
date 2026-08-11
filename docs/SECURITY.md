# Security model

## Trust and threat model

PetPass stores personal contact details, animal identity, and signed veterinary facts. Main threats:
stolen credentials, owner cross-record access, CSRF, SQL injection, XSS, silent medical-history
edits, database theft, malicious image/upload content, and container privilege escape.

v1 excludes uploads and public share links, reducing attack surface. TLS terminates at operator
reverse proxy.

## Implemented controls

- Least-privilege roles; no signup; vet authority verification flag.
- Owner visibility tied to normalized owner email. Unowned objects return 404.
- Password hashes: PBKDF2-HMAC-SHA-256, 600,000 rounds, per-user 128-bit salt.
- Session tokens: 256-bit random; database stores SHA-256 digest only.
- Session expiry: 30-minute idle, 8-hour absolute.
- Cookies: `HttpOnly`, `SameSite=Strict`, `Secure` and `__Host-` prefix under HTTPS.
- CSRF hidden token, exact-origin check, cross-site Fetch Metadata rejection.
- Generic login error and in-memory throttle.
- Prepared SQLite statements; foreign keys and constraints.
- Server-side HTML escaping; CSP allows only same-origin assets and blocks inline script.
- Security headers: CSP, frame deny, no sniff, no referrer, limited permissions.
- Signed health records are append-only. Physical issue locks core identity in application flow.
- Mutation audit hash chain exposes deletion/reordering/modification during verification.
- Container: distroless, non-root, read-only root, dropped capabilities, no-new-privileges.

## Operator duties

- TLS and exact `APP_ORIGIN` required on internet.
- Encrypt host disks and all backups.
- Restrict volume access; rotate admin password; create named staff accounts.
- Verify vet authority outside app before checking `vet_verified`.
- Put rate limiting at reverse proxy for multi-instance/persistent enforcement.
- Monitor logs without adding personal data.
- Define GDPR controller, lawful basis, retention, subject-access, correction, and incident process.
- Run restore drills, vulnerability scans, dependency updates, and independent penetration test.

## Known security gaps

- SQLite not application-encrypted.
- Audit chain is tamper-evident, not externally anchored.
- Login throttle resets on restart and is process-local.
- No MFA/WebAuthn yet.
- No user self-service password change/recovery yet.
- Admin account can perform veterinarian-like writes; use separate verified vet accounts
  operationally.
- Compromise of server process can read live records and sessions.

Report vulnerabilities privately to repository security contact. Do not open public issue containing
personal data or exploit details.
