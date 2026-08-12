# Version 2 product plan

## Goal

Give pet owners a fast private reference when physical passport is unavailable, especially during
urgent veterinary care. App stores owner-entered copies only; it makes no legal or clinical claim.

## Core journey

1. Anyone creates an account.
2. Account owner completes contact details.
3. Owner adds one or more pets.
4. Owner creates one or more passport copies for owned pets.
5. Owner copies identification and health entries from physical booklet.
6. Owner opens single-page emergency view for clinic reference.

## Authorisation

One account type. Every owner can read and write only records linked to account email. Pet IDs,
passport IDs, form owner IDs, and API paths are checked server-side. Foreign records return 404. No
admin, veterinarian, auditor, authority-verification, or role-management UI/routes exist.

## Scope

| Area           | Behavior                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| Account        | Public signup, login, logout, profile                                    |
| Pet            | Dog, cat, ferret description copied from booklet                         |
| Passport       | Country and physical booklet number; app never generates official number |
| Identification | Microchip or legacy tattoo details copied by owner                       |
| Health         | Booklet entry type, product/lab, batch/reference, dates, result, notes   |
| Emergency      | One-page view for quick clinic reference and PDF/print                   |
| Operations     | Health, SQLite backup, audit verification, separate Compose volume       |

## Deliberately excluded

- Official issuance, validation, stamps, signatures, QR, laminate, stock control.
- Veterinary attestation or verified medical identity.
- Travel readiness or legal advice.
- Staff/user administration and role workflows.
- Public share links and uploads.

## Stack

Deno 2.9, TypeScript, native `Deno.serve`, server-rendered HTML, SQLite WAL, PBKDF2, distroless
non-root container, Deno tests, GitHub Actions.

## Acceptance

- Signup-to-emergency-view flow works through browser UI.
- Account A never sees or changes account B records.
- UI renders only usable actions.
- All views state the digital copy is not official.
- Restart preserves sessions and records; backup and audit verification pass.
