# AUDIT-BOOK-AUTH-ROOT-CAUSE-01 — Root cause of the unauthenticated /api/book endpoint

## Direct answer

`POST /api/book` was created without authentication in:

- **Commit:** `6a083f4c0805922b51fae5af300d00c1e380b008`
- **Date:** 2026-06-30 01:23:19 UTC
- **Author:** `Managed via Tart <admin@Manageds-Virtual-Machine.local>`
- **Co-author:** `Claude Sonnet 4.6`
- **Message:** `FEAT-06/07: Duffel booking API, price alerts API, check-alerts cron`
- **Ticket reference:** `FEAT-06/07` — a composite feature identifier, not a normal single
  pipeline ticket ID in this repo's later `PREFIX-slug-NN` convention.

The initial implementation accepted caller-provided passenger data, read `DUFFEL_KEY`, fetched
the Duffel offer, and submitted an instant balance-funded order. It never had an `auth()`,
session, ownership, entitlement, or CSRF/origin check — from the very first commit. Every later
commit touching this file (idempotency, error handling, Docker build fixes) preserved that
boundary without ever revisiting it.

## Why QA never caught it

**There is no corresponding pipeline artifact for `FEAT-06/07` at all.** `docs/pipeline/` did not
exist yet at the route's creation commit — the first commits touching that directory appeared
2026-07-02, more than two days later. This route was built before, and outside, the ticket
pipeline discipline this repo now follows.

The only TEST document that later touches this route (`docs/pipeline/FLIGHT-SEARCH-DUFFEL-REPLACEMENT/04-test.md`,
an unrelated flight-provider migration) explicitly verified the booking route was **left
unchanged** as a regression check — it never inspected auth:

> "Checked the diff completely. No changes have been made under `app/api/book/`... The booking
> boundaries remain completely untouched and clean."

**Structural gap, not just an execution miss:** AGENTS.md's Stage 6 PASS criteria (tsc exits 0,
tests exit 0, every design-spec state implemented, no visual regression, mobile/desktop usable)
does not require authentication, authorization, entitlement, or abuse/rate-limit checks for any
route, sensitive or not. Even a diligent QA pass following the checklist as written would not be
structurally required to catch this class of bug. This is worth fixing in AGENTS.md itself, not
just this one route.

## Verdict

Implementation-and-process gap: a real, money-moving endpoint was shipped before the current auth
infrastructure and pipeline discipline existed, and nothing in the subsequent process — six later
commits, one tangential TEST pass — ever re-examined its trust boundary. Mitigated tonight via
`BOOKING_ENABLED=false` in production; real fix (require an authenticated, session-bound caller)
is a separate, not-yet-scoped ticket.
