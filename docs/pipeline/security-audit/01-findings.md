# TEST-SECURITY-SECRETS-AUDIT-01 — Findings

Audit date: 2026-08-16 (GMT)  
Scope: current `HEAD`, `origin/main`, all reachable Git refs/history, tonight's code changes, and every `app/api/**/route.ts` handler.  
Mode: investigation only; no fixes, commits, pushes, or external mutations were performed.

## Executive result

**Secrets: CLEAR.** No complete credential matching any supplied fingerprint or named-variable assignment pattern was found in the current committed tree or any of the 1,618 commits reachable through `--all`. `HEAD` and `origin/main` both resolved to `9b5da5eeee3f0513c4af25ad875c8809569ed78b` during the audit. The RapidAPI inventory contains only deliberately truncated `prefix...` fingerprints.

**Security posture: NOT CLEAR.** One high-severity authorization flaw exists in the deployed booking path: an unauthenticated caller can submit a Duffel order that uses the application's provider account/balance whenever booking is enabled, and both deployment branches explicitly set `BOOKING_ENABLED=true`. A lower-severity unauthenticated alert-cancellation path also exists. No injection vulnerability was found in the SkyScrapper entity-ID change.

## Part 1 — Secret leak check: CLEAR

### 1.1 Supplied credential fingerprints

- Searched every revision reachable from every local ref for all six supplied RapidAPI prefixes and the supplied Zernio, Railway, and Krater prefixes.
- The six RapidAPI prefixes occur only in `docs/pipeline/rapidapi-audit/01-inventory.md`, lines 21–40. Every occurrence ends immediately in `...`; none is a complete-looking token.
- Those truncated fingerprints were introduced by commit `9d4171fa5375bf686f02724aab3864c13cc91c01` (`AUDIT-RAPIDAPI-FULL-INVENTORY-01`). No earlier or later full form was found.
- The Zernio prefix `sk_3373a8f9`, Railway prefix `rlwy_oacs_0524e98c`, and Krater prefix `kr_live_` do not occur in any reachable revision.
- No supplied prefix occurs elsewhere in the current working tree.

### 1.2 Named secret assignments

- Searched history for `RAPIDAPI_KEY`, `ZERNIO_API_KEY`, `KRATER_API_KEY`, `RAILWAY_API_TOKEN`, and `RUNWARE_API_KEY` followed by `=` or `:` and classified the following token without printing it.
- No real-looking assigned value was found. Matches were environment lookups, GitHub Actions `${{ secrets.* }}` indirections, deliberately short test fixtures, bare variable names, or truncated documentation fingerprints.
- The requested committed pipeline areas were checked individually: `rapidapi-audit`, `social-content-batch`, `dark-homepage-prototype`, `homepage-light-refine`, and `skyscrapper-entityid-fix`. None contains a complete-looking key.

### 1.3 Environment files and ignore coverage

- `.gitignore` contains `.env*`, covering `.env`, `.env.local`, and other `.env` variants.
- `*.pem` is also ignored. There is no broader credentials-name glob, but no credentials-shaped or `.env*` file was found in tracked path history.
- A full historical tracked-path scan found no `.env` or `.env.*` path ever committed.
- GitHub Actions deploy configuration references repository secrets symbolically; it does not embed their values.

### Part 1 conclusion

**CLEAR — no key rotation is indicated by repository contents examined in this audit.** This conclusion covers reachable local refs, including the audited `origin/main`. It cannot prove the absence of objects that exist only on an un-fetched/deleted remote ref or outside this repository.

## Part 2 — Bugs and vulnerabilities in tonight's changes

### High — unauthenticated Duffel order creation uses the application's provider balance

Although not introduced tonight, this is a real payment-adjacent vulnerability discovered while tracing tonight's search/provider path.

- `app/api/book/route.ts:191–280` accepts `POST` without `auth()`, session ownership, an entitlement check, CSRF/origin enforcement, or a caller-specific rate limit, then calls `createDuffelOrder`.
- `app/api/book/route.ts:67–164` authenticates to Duffel using the server's `DUFFEL_KEY` and creates an instant order with a `balance` payment. Therefore the caller need not possess the application credential or provide their own payment instrument.
- The client supplies `offerId`, `fareContext`, and passenger identity. Fetching the offer and comparing price/passenger count improves integrity, but does not authorize the caller or bind the offer to a server-issued search/session.
- `.github/workflows/deploy.yml:67` and `:102` explicitly deploy with `BOOKING_ENABLED=true`, so the feature flag is not a mitigating default in the pushed production configuration.
- Idempotency only prevents exact duplicate submissions for the same offer/passenger tuple. An attacker can use different valid offers or passenger data.

Impact: unauthorized orders and spend against the application's Duffel account/balance, operational fraud, and processing of attacker-supplied passenger PII. This should be treated as the first remediation item.

### Medium — SkyScrapper entity resolution can silently select a nonmatching airport

- The API route safely normalizes user input through `resolveToIATA` at `app/api/search/route.ts:193–215`; it yields exactly three uppercase letters or a known mapped IATA value.
- Both search calls construct queries using `URLSearchParams` (`lib/providers/skyScrapper.ts:112–119` and `:201–216`). Provider-returned entity IDs are also encoded through `URLSearchParams`. No URL/query injection path was found.
- However, `resolveEntityId` sorts all returned candidates by score and takes element zero at `lib/providers/skyScrapper.ts:132–152`. If the upstream response contains no exact `skyId === normalizedIata`, it still accepts the highest-ranked unrelated airport/city candidate and caches that entity ID for 30 days.

Impact: a provider ambiguity or malformed response can bind an IATA cache key to the wrong entity and return fares for the wrong airport. The result is data-integrity risk, not code injection. Exact-IATA matching should be mandatory before caching.

### Low — homepage refinement changed global design tokens and typography across the product

- Commit `eb3ea9df2f3b270e5552bc53de99c0f67efc10ae` changed the root `--radius-card` from 24px to 16px and globally changed `.text-display` and `.text-h2` sizes, weight, leading, and tracking in `app/globals.css:98` and `:214–255`, with larger desktop overrides at `:503–511`.
- These tokens/classes are consumed across account, admin, auth, blog, deals, destinations, flights, onboarding, and many shared components—not only the homepage.

Impact: the change can cause site-wide wrapping, spacing, and visual-regression changes outside the ticket's homepage surface. This is a concrete scope/regression hazard, though static inspection did not prove an unusable page.

### Informational — reviewed changes with no security defect found

- `DealCard.tsx` and `LockedDealCard.tsx`: the relevant commit adds only `shadow-[var(--shadow-card-rest)]`; no unexpected behavior or data handling was added.
- `/preview/dark-home`: this is a server component that reads the same deal/tracked-hotel records used by the homepage and renders selected public deal fields. It does not read or serialize `process.env`, cookies, headers, sessions, debug objects, or credentials. `robots: { index: false, follow: false }` discourages indexing but is not access control; no confidential content was found that would require access control.
- Dark-preview CSS is scoped under `.theme-dark-preview`. The unscoped light-home additions and global typography/token edits are covered above. No secret-bearing CSS, remote import, or script injection was found.
- `components.json` aliases are normal for the repository layout. The added dependency names are the expected packages: `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css`, `lucide-react`, and `motion`. The lockfile resolves each from `registry.npmjs.org` and records integrity hashes; no obvious typo-squat or wrong package name was found.
- Live advisory lookup could not be completed because the environment could not resolve `registry.npmjs.org`; `npm audit --omit=dev --json` failed before receiving advisory data. Accordingly, this audit makes no claim that the installed dependency versions are free of all published CVEs.

## Part 3 — Route and authentication findings

### High — `/api/book` lacks authentication/authorization

This is the same high-severity finding detailed in Part 2. It is the only route gap found that directly performs a payment/order-adjacent provider mutation using a server credential. It is deployed as enabled.

### Low — legacy alert deletion uses email plus alert ID instead of session or capability token

- `DELETE /api/alerts` at `app/api/alerts/route.ts:128–149` has no session check and deactivates a row using caller-supplied `email` and `id`.
- The newer alert-management/unsubscribe routes use a random `alert_unsubscribe_token`, but this legacy endpoint does not.

Impact: anyone who obtains or guesses both values can cancel another person's alert. This is an integrity/availability issue rather than disclosure. Use an authenticated ownership check or the existing high-entropy unsubscribe capability.

### No auth gap found in privileged/account routes

- Every `/api/admin/**` route calls `requireAdmin()` before lookup or mutation.
- Account alerts, watchlist, privacy request, onboarding, Stripe checkout, and Stripe portal require a signed-in session.
- Stripe webhook verifies `stripe-signature` with `STRIPE_WEBHOOK_SECRET`.
- Pipeline and scheduled email routes fail closed when `PIPELINE_SECRET` is absent and require an exact bearer value.
- Premium natural-language search parsing gates the OpenAI-backed operation through `getPaywallContext().premium`.
- Public search, airport lookup, baggage, calendar, deal reads, scoring, analytics ingestion, alert creation, hotel-context preparation, and hotel-document checks appear intentionally public. They do consume DB/provider/AI-adjacent resources in places and do not show route-local rate limiting, so deployment-level throttling should be confirmed separately; absence of authentication alone is not classified as a bug for these public product surfaces.

## Recommended remediation order (no fixes made)

1. Disable in-app booking in deployment until `/api/book` requires an authorized session and a server-issued, session-bound offer context; add abuse/rate controls before re-enabling.
2. Require an exact IATA match before caching/using a SkyScrapper entity ID.
3. Replace legacy alert deletion credentials with authenticated ownership or the existing random unsubscribe token.
4. Scope homepage typography/radius changes or perform explicit regression testing across all consumers.
5. Run `npm audit --omit=dev` (or the organization's dependency scanner) in a network-enabled CI environment.
