# Complete price alert contract repair — 2026-09-09

Implementation is complete locally. Production migration, commit, push, and deployment are blocked by this session's filesystem/network restrictions. No production retirement count is available, and no real alert email was sent.

## Delivered behavior

- Reuse `price_alerts.currency`; add `travel_start`, `travel_end`, `trip_type`, `passenger_count`, and `hotel_provider`.
- Explicit one-way trip type distinguishes an intentionally absent return from missing legacy data. Flight targets use party totals; hotel targets use nightly prices for the provider's fixed two adults/one room search.
- A transactional, run-once migration in `lib/db/schema.sql` deactivates incomplete legacy alerts, records the retired-row count in `alert_contract_migrations`, and adds a constraint preventing incomplete active rows. `npm run migrate:alerts` executes that exact schema block under a table lock and prints the persisted count after commit.
- FlightsClient sends the live quote's currency, exact dates, passenger count, and party-total threshold. Missing pricing evidence, mismatched dates, and mixed-currency candidate sets prevent signup. The API validates completeness before insertion. The unmounted reusable AlertSignup also requires quote context and supports hotel identity. No mounted hotel-alert signup flow exists.
- Checker uses fare quotes with matching route/dates/currency/party count, never monthly trends. Both normal Travelpayouts search and checking require matching top-level response currency. Its provider cache is versioned to v5; missing departure/return dates are never filled in from the request, and mismatched destination-map keys are rejected.
- [Travelpayouts API documentation](https://support.travelpayouts.com/hc/en-us/articles/203956163-Aviasales-Data-API) describes response currency. Requiring that evidence prevents a requested currency from silently becoming an incorrectly labeled default-currency quote.
- Hotels use the live Booking.com provider with stored stay dates and explicit matching currency. Both `source = booking.com` and the provider's stringified numeric ID must match. Strict currency cache entries are isolated from defaulted search entries.
- Emails state actual currency, dates, and price scope. `--dry-run` sends no emails and writes no checking state. The daily GitHub workflow follows flight-snapshot.yml's Node/npm/secrets pattern; concurrent runs are serialized.

## Verification

- `npx tsc --noEmit --incremental false`: exit 0.
- `npm test -- --passWithNoTests`: exit 0; 156 suites, 1,617 tests passed. Jest also reports a standalone-package collision and worker teardown warning.
- All 20 actual-job regression tests failed on the original checker and passed on the fix. The requested `git stash` attempt failed with `could not write index`; the baseline test instead temporarily restored `git show HEAD:scripts/check-alerts.ts`, with the fixed file restored in a Python `finally` block. Provider, DB, and email transports were mocked throughout.
- Independent checker approved the final diff and separately passed 47 focused tests in 3 suites. It traced the EUR-flight and cross-provider hotel-ID scenarios end to end. Its findings about invented dates, discarded destination evidence, and missing currency evidence were fixed and re-reviewed.
- `git diff --check`: exit 0.

## Blocked production steps

1. Azure CLI initially could not write its default session file. Retrying with a temporary config directory then failed DNS resolution for `login.microsoftonline.com`, before obtaining DATABASE_URL. The migration has **not run against production**; retired rows are **unknown**, not zero.
2. Commit failed because `.git/index.lock` cannot be created in the read-only `.git` directory.
3. Push failed DNS resolution for github.com. `gh run list --workflow deploy.yml` also failed API connectivity. No new deployment run ID exists to watch, so `gh run watch <id> --exit-status` could not be performed.

The approved migration should run before deploying this change, using the existing authorized credential capture command (never print DATABASE_URL):

```sh
DATABASE_URL=$(az containerapp show --name expaify --resource-group expaify-rg --query "properties.template.containers[0].env[?name=='DATABASE_URL'].value" -o tsv) && test -n "$DATABASE_URL" && DATABASE_URL="$DATABASE_URL" npm run migrate:alerts
```

Then commit only the repair files (leave unrelated `.claude/` content alone), push to main, obtain the deployment run for that commit, and watch it with `gh run watch <id> --exit-status`. No additional policy approval is needed.
