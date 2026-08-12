# PetPass

Self-hosted Deno/TypeScript app for keeping digital copies of physical EU pet passports. An owner
creates an account, adds pets, transcribes passport details, and opens a clean emergency view for
quick reference at a veterinary clinic.

> **Not an official document.** PetPass does not issue, replace, validate, or extend a pet passport.
> Physical booklet remains authoritative and is required for travel and official checks.

Version 2 is the current streamlined application. The clinic-oriented multi-role edition remains
preserved in release `v1.0.4`. Compose project and volume names differ, so both versions can coexist
without sharing data.

## Features

- Public self-service signup; one account type only.
- Strict account ownership: each account sees and changes only its own pets and passport copies.
- Owner contact profile, dogs/cats/ferrets, physical booklet number, microchip or legacy tattoo.
- Rabies, titre, parasite treatment, vaccination, clinical, legalisation, and other copied entries.
- Single-page emergency view with owner contact, animal, identification, and health information.
- Clear non-official warning in normal and emergency views.
- PBKDF2-SHA-256 passwords, opaque sessions, CSRF/origin checks, strict headers, login throttling.
- SQLite WAL storage, hash-chained internal mutation log, consistent backup command.
- Distroless non-root container and GitHub Actions checks.

No administrators, veterinarians, auditors, role management, travel assessment, digital signing, or
physical-issue workflow exists in this edition.

## Quick start

Docker Compose:

```bash
cp .env.example .env
docker compose up --build --detach
```

Open `http://localhost:8000`, choose **Create one**, then add your details and pet.

Apple container:

```bash
container build --tag ghcr.io/nehoko/eu-pet-passport:latest .
container-compose --file compose.apple.yml up --env-file .env --detach
```

For internet exposure, use TLS reverse proxy and exact origin:

```dotenv
APP_ORIGIN=https://pets.example.com
```

## Data and backup

Version 2 uses volume `petpass-eu-v2_petpass_v2_data`, separate from the v1 clinic edition.

```bash
docker compose exec app backup /data/petpass-backup-$(date +%F).db
docker compose exec app verify-audit
```

Database contains private owner and animal-health data. Encrypt host disk and off-host backups.

## Development

Requires Deno 2.9.4+.

```bash
deno task dev
deno task ci
docker build -t petpass:dev .
```

Endpoints:

- `GET /health/live`
- `GET /health/ready`
- authenticated `GET /api/v1/passports/:id`

## Documents

- [Product plan](docs/PLAN.md)
- [EU-copy boundary](docs/EU-COMPLIANCE.md)
- [Security model](docs/SECURITY.md)
- [Operations](docs/OPERATIONS.md)

## License

MIT. EU emblem and official legal text remain governed by EU reuse rules.
