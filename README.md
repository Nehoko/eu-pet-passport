# PetPass EU

Self-hosted Deno/TypeScript web app for managing digital companion records for EU pet passports.
Covers current 2026 model, secure roles, append-only veterinary entries, travel-readiness warnings,
printable 100 × 152 mm record copies, Docker deployment, and CI/release automation.

> **Legal boundary:** PetPass EU cannot issue an official EU pet passport. Only an authorised
> veterinarian using authority-controlled physical booklet stock can do that. Every print view says
> **RECORD COPY — NOT VALID AS ORIGINAL PASSPORT**.

## Features

- 2026 EU model: Sections I-XII from Implementing Regulation (EU) 2026/705.
- Owners, dogs, cats, ferrets, physical booklet numbers, microchips, legacy tattoos.
- Rabies vaccination, titre test, Echinococcus and parasite treatment, other vaccinations, clinical
  examination, legalisation, national notes.
- `admin`, authority-verified `veterinarian`, `owner`, and `auditor` roles.
- No public signup. Admin provisions accounts; vet status must be verified.
- PBKDF2-SHA-256 passwords, opaque sessions, 30-minute idle timeout, CSRF and origin checks, strict
  security headers, generic login errors, throttling.
- Signed medical entries append-only. Core identity locks when physical issue is recorded.
- Hash-chained audit events.
- Advisory travel check for identification, rabies timing/validity, and destination-specific
  Echinococcus window.
- SQLite WAL database and consistent online backup command.
- Native `linux/amd64` and `linux/arm64` GHCR release workflow.

## Quick start

Requirements: Docker Engine with Compose v2.

```bash
cp .env.example .env
mkdir -p secrets
openssl rand -base64 24 > secrets/admin_password.txt
docker compose up -d
```

Open `http://localhost:8000`. Sign in with `APP_ADMIN_EMAIL` and password stored in
`secrets/admin_password.txt`.

For internet exposure, put app behind TLS reverse proxy and set exact public origin:

```dotenv
APP_ORIGIN=https://pets.example.com
```

Cookie becomes `Secure` automatically for HTTPS origins.

## Data and backup

Data lives in named volume `petpass_data`. Create transactionally consistent backup:

```bash
docker compose exec app backup /data/petpass-backup-$(date +%F).db
```

Copy backup out with your container/volume tooling. Encrypt backups; database contains personal and
veterinary data. Test restore regularly. See [operations guide](docs/OPERATIONS.md).

## Development

Requires Deno 2.9.4+.

```bash
export APP_ADMIN_EMAIL=admin@example.test
export APP_ADMIN_PASSWORD='development-password-long-enough'
deno task dev
```

Checks:

```bash
deno task ci
docker build -t petpass-eu:dev .
```

Health endpoints:

- `GET /health/live` - process response.
- `GET /health/ready` - database readiness and model version.

Authenticated JSON snapshot: `GET /api/v1/passports/:id`.

## Project documents

- [Product and implementation plan](docs/PLAN.md)
- [EU model mapping and sources](docs/EU-COMPLIANCE.md)
- [Security model](docs/SECURITY.md)
- [Operations and backup](docs/OPERATIONS.md)

## EU references

- [Current model passport - Implementing Regulation (EU) 2026/705](https://eur-lex.europa.eu/eli/reg_impl/2026/705/oj/eng)
- [Official Annex I visual PDF](https://www.ruokavirasto.fi/globalassets/yritykset/tuonti-ja-vienti/elaimet-eu-maat/nettisivut_eu-passi_eng_2026.pdf)
- [Current movement rules - Delegated Regulation (EU) 2026/131](https://eur-lex.europa.eu/eli/reg_del/2026/131/oj/eng)
- [Traceability and issuance - Delegated Regulation (EU) 2026/132](https://eur-lex.europa.eu/eli/reg_del/2026/132/oj/eng)
- [European Commission travel guidance](https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/travelling-pet-within-eu_en)

Rules change. Deployer must review national rules and update advisory logic before relying on it.

## License

MIT. EU emblem and official legal text remain governed by their respective EU reuse rules. No
third-party reference photographs are shipped.
