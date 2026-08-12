# Operations

## Deployment

App listens on 8000. Run one replica. Use TLS reverse proxy and set `APP_ORIGIN` to exact external
origin. `/data` must be writable by UID/GID 65532; root filesystem can stay read-only.

Personal Compose project and volume:

- project: `petpass-personal`
- volume: `petpass-personal_petpass_personal_data`

These names intentionally avoid clinic-edition `petpass-eu` data.

## Backup

```bash
docker compose exec app backup /data/petpass-backup-2026-08-12.db
docker compose exec app verify-audit
```

Move backup to encrypted, access-controlled, off-host storage. Never copy live SQLite files
directly; WAL state may be omitted.

## Restore drill

1. Stop app.
2. Preserve current volume.
3. Place verified backup at `/data/petpass.db`, owned by 65532:65532.
4. Start app.
5. Check `/health/ready`, sign in, inspect sample record.
6. Run `verify-audit`.

## Monitoring

- Liveness: `/health/live`
- Readiness: `/health/ready`
- Container status/logs
- Audit integrity
- Volume capacity and backup completion

## Failure notes

- `database is locked`: enforce one replica; use local/block storage.
- `permission denied` on `/data`: set volume ownership to 65532:65532.
- Login cookie missing: ensure proxy and `APP_ORIGIN` protocol/host match.
- Forgotten password: no recovery flow yet. Restore access only through a reviewed future recovery
  mechanism; do not edit password hashes manually.
