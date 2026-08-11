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
- Login cookie missing: HTTPS origin requires HTTPS browser access; ensure proxy and `APP_ORIGIN`
  agree.
- `permission denied` on `/data`: volume ownership must be 65532:65532.
