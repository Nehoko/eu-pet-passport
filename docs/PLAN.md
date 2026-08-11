# Product and implementation plan

## Goal and boundary

Build self-hosted record manager matching data structure and visual hierarchy of current EU pet
passport. It supports clinic operations around a physical booklet. It does not create legal identity
documents, national registrations, signatures, stamps, laminates, or official numbers.

Success means:

1. Verified staff can register owner, eligible pet, controlled physical passport number, identity,
   and health history.
2. Owner can see only records linked by owner email.
3. Signed veterinary facts cannot be silently edited.
4. Record printout follows Sections I-XII and carries non-original watermark.
5. Operator can deploy one secure container, persist/backup SQLite, and update from GHCR.

## Required functionality

| Area           | v1 behavior                                                                                 | Acceptance                                         |
| -------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Identity       | Owner, dog/cat/ferret, microchip, legacy tattoo                                             | ISO chip is 15 digits; tattoo predates 3 July 2011 |
| Passport       | Country code + physical booklet number, 2026 model, draft/recorded state                    | App never invents official number                  |
| Health         | Sections V-XII, signer snapshot, append-only entries                                        | Signed record has actor and UTC timestamp          |
| Physical issue | Verified vet/admin records real booklet issue after password re-entry                       | Locks Sections I-IV; requires identity + rabies    |
| Travel         | Advisory checks for rabies, chip timing, 12-week/21-day warnings, Echinococcus destinations | Result says advisory; ruleset visible              |
| Print          | Cover + I-XII, 100 × 152 mm CSS pages                                                       | Watermark on every internal page; no official QR   |
| Audit          | Hash-chain for mutations                                                                    | Chain verifier returns pass/fail                   |
| Operations     | Health, backup, Compose, non-root container                                                 | Restart keeps data; health reports database        |

## Authorisation

| Role                    | Read                            | Write                                         | Sensitive authority                |
| ----------------------- | ------------------------------- | --------------------------------------------- | ---------------------------------- |
| Admin                   | all                             | users, owners, pets, records                  | verify vets; record physical issue |
| Verified veterinarian   | all clinical records            | owners, pets, identity, signed health records | record physical issue              |
| Unverified veterinarian | authenticated only              | none                                          | verification required              |
| Owner                   | own email-linked pets/passports | none                                          | no issue/sign action               |
| Auditor                 | all                             | none                                          | audit trail access                 |

No public signup. Role changes remain future admin feature; v1 admin creates correct role. Physical
issue and signed entries require verified vet or admin. Physical issue also requires current
password.

## Stack

- Deno 2.9 / TypeScript 6.
- Native `Deno.serve` and Web APIs; no browser framework or CDN runtime dependency.
- Built-in `node:sqlite`, WAL, foreign keys, synchronous full durability, 5-second busy timeout.
- Server-rendered semantic HTML; custom responsive and passport-print CSS.
- Node-compatible crypto for PBKDF2, secure tokens, constant-time comparison, audit SHA-256.
- `Deno.test` + Node strict assertions.
- Multi-stage compiled binary in distroless non-root container.

## Data model

`users -> sessions`; `owners -> pets -> passports -> identifications / medical_records`; mutations
-> `audit_events`.

Medical record JSON preserves section-specific payload while common columns enforce signer, status,
timestamp, and passport relation. Future migration can normalize high-volume fields without changing
API/view contract.

## Security controls

- 600,000-round PBKDF2-HMAC-SHA-256, 16-byte salt.
- 32-byte opaque session token; only SHA-256 digest stored.
- 8-hour absolute and 30-minute idle expiry.
- `HttpOnly`, `SameSite=Strict`; `Secure` under HTTPS.
- CSRF token plus origin and Fetch Metadata checks.
- CSP, clickjacking, MIME sniffing, referrer, and browser-permission headers.
- 1 MB form cap, field length limits, prepared SQL.
- Login throttle: eight failures per account/IP pair per 15 minutes.
- Owner records filtered by normalized email; non-owned passport behaves as 404.
- Read-only root filesystem, non-root UID, all Linux capabilities dropped.

## Delivery tasks

- [x] Current EU law and visual model research.
- [x] Product boundary, roles, schema, threat controls.
- [x] Server-rendered app and responsive UI.
- [x] Owner/pet/passport/health/audit flows.
- [x] Print record and readiness advisory.
- [x] Unit, database, and HTTP integration tests.
- [x] Dockerfile, Compose, health, backup.
- [x] CI, security scan, native multi-arch release workflow.
- [ ] National language packs and authority integrations.
- [ ] Attachment/photo processing, encrypted object storage, PostgreSQL adapter.
- [ ] Formal DPIA, penetration test, and national competent-authority approval.

## Known limits

- Single app replica. SQLite file must stay on local/block volume, never shared network filesystem.
- Database is not application-level encrypted. Use encrypted host disk and backup target.
- Owner matching by email assumes admin maintains exact ownership contact.
- Travel check covers common EU baseline, not every national/breed/transport rule.
- English record copy is not official bilingual booklet output.
- No national registry integration; therefore no QR is rendered.
