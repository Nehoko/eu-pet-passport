# Operations

## Deployment

Use TLS reverse proxy. Forward original host/protocol and set `APP_ORIGIN` to exact external origin.
App listens on port 8000. One replica only.

Data directory `/data` must be writable by UID/GID 65532. Root filesystem can remain read-only.

## Backup

Create SQLite-consistent snapshot while service runs:

```bash
docker compose exec app backup /data/petpass-backup-2026-08-11.db
```

Move snapshot to encrypted, access-controlled, off-host storage. Retention must follow local law and
clinic policy.

## Restore drill

1. Stop app.
2. Preserve current volume before overwrite.
3. Place verified backup as `/data/petpass.db`, owned by 65532:65532.
4. Start app.
5. Check `/health/ready`, sign in, inspect sample records.
6. Run `docker compose exec app verify-audit`.

Never copy live `petpass.db` directly without SQLite backup command; WAL state may be omitted.

## Administrator password recovery

`APP_ADMIN_EMAIL` and `APP_ADMIN_PASSWORD` create the first administrator only when the database is
empty. Changing them later does not rotate a stored password.

Use the offline reset command. It accepts the target email as a non-secret argument, reads the new
password from `APP_ADMIN_PASSWORD` or `APP_ADMIN_PASSWORD_FILE`, requires an existing active admin,
revokes every session for that account, and appends `admin.password_reset` to the audit chain. It
does not create accounts, change roles, or reactivate disabled accounts.

Docker Compose:

```bash
docker compose down
docker compose run --rm app admin-reset admin@example.com
docker compose up -d
```

Apple container with `container-compose`:

```bash
container-compose --file compose.apple.yml down --env-file .env
container rm petpass-eu-app # only if the stopped container still exists

container run --rm \
  --env-file .env \
  --volume petpass-eu_petpass_data:/data \
  ghcr.io/nehoko/eu-pet-passport:1.0.4 \
  admin-reset admin@example.com

container-compose --file compose.apple.yml up --env-file .env --detach
```

Replace the email with the existing admin login. Keep the new password out of shell arguments and
command history. Back up the database first when practical. Do not delete the volume.

## Upgrade

```bash
docker compose pull
docker compose up -d
docker compose ps
```

Pin `APP_VERSION` for controlled upgrades. Back up before major/minor upgrade. v1 migrations run
automatically and are forward-only.

## Monitoring

- Liveness: `/health/live`
- Readiness: `/health/ready`
- Container health: Compose/Docker status
- Audit integrity: `docker compose exec app verify-audit`
- Capacity: data volume bytes/inodes and backup completion

## Failure notes

- `database is locked`: another process/replica is using same file or slow storage; enforce one
  replica.
- Bootstrap password error: empty database requires secret file with at least 14 characters.
- Existing admin rejects changed `.env` password: bootstrap variables do not rotate accounts; use
  the offline `admin-reset` command.
- Owner absent from pet dropdown: create an Owner contact under **Owners**. A role=`owner` entry
  under **Users** is only a login account and links by exact email.
- Login cookie missing: HTTPS origin requires HTTPS browser access; ensure proxy and `APP_ORIGIN`
  agree.
- `permission denied` on `/data`: volume ownership must be 65532:65532.
