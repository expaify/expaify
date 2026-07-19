# UX Research: Watchlist & Alert Preference Management

**Ticket:** UXR-WATCHLIST-UX-01 · **Stage:** UXR · **Date:** 2026-07-19
**Feature slug:** `watchlist-ux`
**Upstream:** `docs/pipeline/watchlist-ux/01-discovery.md`

---

## 1. Scope confirmation

The watchlist is a list of **up to 10 tracked cities** (`subscriptions.watchlist TEXT[]`, capped by `subscriptions_watchlist_limit_check`, `lib/db/schema.sql:232-236`), chosen from the 20 tracked markets. Alert cadence is exactly `instant | daily | off` (`subscriptions_alert_preference_check`, `lib/db/schema.sql:224-228`). This brief scopes **city-watchlist + cadence management only** — no saved deals, no new cadence values, no new channels.

## 2. Source audit (verified in this worktree)

Every discovery claim was re-verified against source. Two claims were sharpened; nothing was contradicted.

| Surface | What the code does today | Evidence |
|---|---|---|
| `/account` alerts panel | Only management UI. Last of three sections, premium-only. Batch model: toggles mutate local state only; nothing persists until "Save preferences"; success is a 2-second "Saved ✓" flash on the button. Saves via `PATCH /api/onboarding`. | `app/account/page.tsx:165-181`; `AccountClient.tsx:46-67, 163-170` |
| Watchlist cap behavior | At 10/10, unselected city pills get `disabled` + `opacity-40` with **no explanation** of why, and no hint that removing one frees a slot. | `AccountClient.tsx:134, 141` |
| `/deals/[dealId]` | No watchlist state, no control. Its inline nav has only logo → `/` and "← Back to deals" — **no account link at all**, and it does not use `LandingNav` (which has the account avatar). Alert emails deep-link exactly here. | `app/deals/[dealId]/page.tsx:234-243` |
| `/destinations/[city]` | No watchlist state or control. This is *the* city surface — the natural home for "Watch this city". Renders `DealFeed` with `defaultCity`. | `app/destinations/[city]/page.tsx:75-115` |
| `/deals` feed | No watchlist state. Destination filter pill navigates to `/destinations/[slug]`. | `app/deals/DealFeed.tsx:371-390` |
| Instant alert email | Footer: "Manage prefs" → bare `/account` (no anchor), "Unsubscribe" → one-click **total off**. No per-city or cadence option, even though an instant alert is about exactly one city. | `lib/email/templates/DealAlert.tsx:131-138`; `sendDealAlert.ts:88-89` |
| Daily digest email | Same two footer links. | `lib/email/templates/DailyDigest.tsx:135-137`; `sendDailyDigest.ts:113-114` |
| Unsubscribe landing | `GET` with a side effect sets `alert_preference='off'`, then renders a static page. Success and error copy *mentions* "your account page" but renders **zero hyperlinks** (an `a{}` CSS rule exists but no anchor is ever emitted). Dead end. | `app/api/alerts/unsubscribe/route.ts:43-61` |
| Dead route: watchlist | `PATCH /api/account/watchlist` — **zero callers** (repo-wide grep). Contains its own hardcoded 20-city set. Notably it *is* the right shape for granular writes: partial update, premium-gated, watchlist only. | `app/api/account/watchlist/route.ts:8-12, 28-35` |
| Dead route: alerts | `PATCH /api/account/alerts` — **zero callers**. Supports `alertMinDiscount` 0–90 and `alertTimezone`, neither exposed in any UI (UI only offers 30/40/50). | `app/api/account/alerts/route.ts:31-44` |
| Live write path | `PATCH /api/onboarding` **requires** `alertPreference` + `minDiscountPct` on every call and re-asserts `onboardingDone: true`. A single city toggle must therefore resend the whole preference payload. Not premium-gated (auth only). | `app/api/onboarding/route.ts:27-40` |
| City list duplication | Three drift-prone copies: `TRACKED_MARKET_NAMES` (`lib/trackedMarkets.ts:32`), hardcoded `CITIES` in `DealFeed.tsx:11-15`, hardcoded set in `api/account/watchlist/route.ts:8-12`. (`lib/cities.ts` slug map is a fourth surface but keyed, so it's the display↔slug source, not a duplicate list.) | as cited |
| Delivery logic | Filters correctly on `alert_preference`, `alert_min_discount`, watchlist membership (empty watchlist = everywhere). `upsertSubscription` already supports **partial** patches (`CASE WHEN NULL` per column). The data layer is ready for granular writes. | `sendDealAlert.ts:50-66`; `sendDailyDigest.ts:38-46, 79-80`; `lib/subscription.ts:73-117` |

## 3. Reference patterns (interaction level)

### Google Flights — Tracked prices
- **The tracking control lives on the tracked surface.** A labeled toggle ("Track prices") sits on the route/flight page itself and always shows current state. You never leave the page to start or stop tracking.
- **Per-item persistence, instantly.** Toggling saves immediately — no batch "Save" button, no page-level form. Feedback is inline (toggle state + brief confirmation).
- **A central list mirrors the same control.** The "Tracked prices" management list allows per-item untrack inline; the surface toggle and the list never disagree.
- **Email maps back to the item.** Tracked-price emails link to the specific tracked item and to tracking management, not just a generic account page.

### Booking.com — Price alerts / subscription management
- **Granular unsubscribe in the footer.** Alert emails distinguish "stop this alert" (the specific search/property) from "unsubscribe from all" — the narrow option is offered *alongside*, never instead of, the total one.
- **One-click total unsubscribe stays one click** (CAN-SPAM/RFC 8058); narrower options are additive.
- **The unsubscribe landing confirms and offers a path back:** what you stopped, re-enable, and links to manage remaining subscriptions. It is a recovery surface, not a dead end.

### The delta

| Dimension | Reference | expaify today |
|---|---|---|
| Control location | On the surface being tracked | Only on `/account`, last section |
| State visibility | Always shown where relevant | Shown nowhere except `/account` |
| Persistence | Per-action, immediate | Batch save + 2s flash |
| Email granularity | Per-item stop + cadence + total | Total unsubscribe only |
| Unsubscribe landing | Recovery surface with links | Dead end, zero links |
| Deep link to management | Direct to the specific setting | Bare `/account`, no anchor; email landing page has no account link |

## 4. Design directives (testable)

### D1 — Put a watch toggle with visible state on city surfaces
On `/destinations/[city]` (page header, next to the H1) and `/deals/[dealId]` (title block area), render the member's watchlist state for that city as a single pill control: **"Watch {city}"** (not watching) / **"Watching {city} ✓"** (watching). Premium members only; free and anonymous visitors see nothing (both pages already carry paywall furniture — do not add more upsell clutter). Tapping persists **immediately** (optimistic UI, single request, revert + inline error on failure — reuse the existing pill token pattern from `AccountClient`). States UXDES must spec: not-watching, watching, in-flight, error, **at-cap** (10/10: control stays enabled but explains "You're watching 10 cities — remove one to add {city}" with a link to `/account#alerts`), city-not-in-tracked-markets (hide).
**Test:** from an alert email → `/deals/[dealId]` → stop watching that city in ≤ 2 interactions; toggle state matches `/account` panel after reload; free user sees no control; at 10/10 the cap copy renders.

### D2 — Make instant-alert email footers granular (additive, token-based)
In `DealAlert.tsx` footer add two token-based links alongside the existing ones: **"Stop alerts for {city}"** and **"Switch to daily digest"** (the alert is always about one city and one cadence, so both are unambiguous). `DailyDigest.tsx` keeps manage + unsubscribe (daily is already the lowest non-off cadence; do not invent a weekly cadence). The existing one-click total unsubscribe link must remain, unchanged in position and mechanism. New links reuse the `alert_unsubscribe_token` mechanism — no login. Because the current unsubscribe `GET` mutates on load (prefetch-vulnerable), new links must land on a lightweight confirmation page whose single button performs the mutation (email click + one tap = still ≤ 2 interactions); UXDES should spec that landing, and flag the existing GET-mutation as a DEV-stage fix candidate, not silently copy it.
**Test:** instant email footer shows 4 links (stop {city} / switch to daily / manage / unsubscribe); total unsubscribe still works in one click; "stop {city}" removes only that city and confirms; links work in a logged-out browser.

### D3 — Turn the unsubscribe landing into a recovery surface
The page at `app/api/alerts/unsubscribe/route.ts` must confirm what happened ("Deal alerts are off") and render **at least two real links**: "Switch to daily digest instead" (token-based re-enable at `daily`) and a hyperlink to `/account#alerts` ("Manage alerts"). Never auto re-enable; never add friction before the off state takes effect. Error states (invalid/expired token) must also hyperlink the account page they currently only mention in prose.
**Test:** landing page HTML contains ≥ 2 anchors; "daily instead" sets `alert_preference='daily'` and confirms; expired-token page links to `/account`.

### D4 — Make `/account` alerts management addressable and per-action
Give the alerts section `id="alerts"` and make every "manage" reference point at `/account#alerts` (email `manageUrl` in `sendDealAlert.ts:88` and `sendDailyDigest.ts:113`, cap copy from D1, unsubscribe landing from D3). Add the standard account entry to the `/deals/[dealId]` nav (use `LandingNav` as `/deals` does, or add the avatar link) so the email landing surface has a visible route to preferences. Within the panel, watchlist and cadence changes persist **per interaction** (matching D1's model) instead of the batch "Save preferences" + 2s flash; each control shows its own saved/error state that does not vanish on a timer.
**Test:** `/account#alerts` scrolls to the section; both email templates emit the anchored URL; `/deals/[dealId]` nav contains an account link at 375px and 1280px; toggling one city on `/account` persists after immediate reload with no Save press.

### D5 — One write path, one city list
Exactly **one** authenticated write route serves watchlist + cadence for all UI surfaces (account panel, D1 toggles): recommend adopting the currently-dead `PATCH /api/account/watchlist` and `PATCH /api/account/alerts` (purpose-built partial updates, already premium-gated — `upsertSubscription` supports partial patches) and reserving `PATCH /api/onboarding` for onboarding, **or** deleting both dead routes and extending onboarding — but not both paths, and a city toggle must never resend the full preference payload or re-assert `onboardingDone`. Token-based email/landing writes (D2/D3) are the only other writer. All city lists import from `lib/trackedMarkets.ts` (+ `lib/cities.ts` for slugs): delete the hardcoded sets in `DealFeed.tsx:11-15` and `api/account/watchlist/route.ts:8-12`.
**Test:** repo grep shows one authenticated write route with callers and zero caller-less preference routes; grep for `'Cancún'` outside `lib/trackedMarkets.ts` returns no hardcoded city arrays; a watchlist toggle request body contains only the changed field(s).

## 5. Constraints carried forward

1. All authenticated writes stay behind auth + `isPremium` (403 otherwise); watchlist ≤ 10 from tracked markets; empty watchlist = "everywhere" (preserve `AccountClient.tsx:153` semantics — D1's control must not accidentally flip a 1-city list to "everywhere" without saying so: removing the last city must state "You'll get alerts for every destination").
2. Existing tokens only (`--primary`, `--ink`, `--radius-pill`, pill patterns); usable at 375px and 1280px; D1 adds at most one pill to each surface header. Note the destination breadcrumb is already `hidden md:flex` — the watch pill must not be mobile-hidden the same way.
3. CAN-SPAM: total unsubscribe stays one-click and first-class; new email options are additions. Token links must not require login and must fail to a page that still links to `/account`.
4. Repair scope: no saved-deals, no new cadence values, no new notification channels, no exposure of `alertTimezone`/free-form discount unless UXDES explicitly decides to (the dead alerts route's 0–90 range is a capability, not a requirement).

## 6. Out-of-scope findings (flagged, not actioned)

- The unsubscribe `GET`-with-side-effect is prefetch-vulnerable today (mail scanners can silently turn alerts off). Fix belongs to DEV stage; D2/D3 must not replicate the pattern.
- `PATCH /api/onboarding` is auth-gated but not premium-gated, unlike the dead account routes — worth aligning when D5 consolidates.
- `alert_timezone` affects digest send hour (`sendDailyDigest.ts:41-45`) but is invisible and uneditable in every UI; defaulted to America/New_York.

---

**Next stage:** UXDES — `UXDES-WATCHLIST-UX-01`: produce the full design spec for D1–D5 (every state, final copy, Tailwind/token patterns, 375px + 1280px, keyboard/focus) in `docs/pipeline/watchlist-ux/03-design.md`.
