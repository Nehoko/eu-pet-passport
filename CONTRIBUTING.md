# Contributing

1. Open issue describing change and legal/data impact.
2. Create focused branch.
3. Run `deno task ci` and container smoke test.
4. Update EU source review date when changing compliance/readiness logic.
5. Never commit real owner, pet, passport, licence, or credential data.

Signed medical facts are append-only by design. Changes that weaken authorisation, audit, watermark,
or physical-document disclaimer need explicit security review.
