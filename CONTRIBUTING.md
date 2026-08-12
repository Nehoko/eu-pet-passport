# Contributing

1. Open issue describing change and legal/data impact.
2. Create focused branch.
3. Run `deno task ci` and container smoke test.
4. Update EU source review date when changing copied fields or legal boundary.
5. Never commit real owner, pet, passport, licence, or credential data.

Copied entries remain append-only in current schema. Changes weakening account isolation, audit, or
non-official disclaimer need explicit security review.
