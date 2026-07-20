# Implementation Slice: Watchlist & Alert Preference Management

**Ticket:** REPAIR-CODEX-WATCHLIST-UX-SLICE-01  
**Stage:** REPAIR planning slice  
**Date:** 2026-07-20  
**Upstream:** `01-discovery.md`, `02-research.md`, `03-design.md`

## Goal

Ship the smallest safe implementation that lets premium members remove a watched city or reduce alert frequency from the deal, destination, account, and instant-alert email paths without introducing saved deals, new cadence values, or another preference write model.

This slice is a plan only. It does not edit app code.

## Implementation order

### Slice 1 — Backend/API contracts first

This is the smallest safe first slice because every UI control in the design depends on partial, premium-gated writes. Do this before any visible controls are wired.

Files to edit:

- `app/api/account/watchlist/route.ts`
- `app/api/account/alerts/route.ts`
- `lib/trackedMarkets.ts`
- `app/deals/DealFeed.tsx`
- `app/api/account/watchlist/__tests__/route.test.ts` (new)
- `app/api/account/alerts/__tests__/route.test.ts` (new or extend if created elsewhere)

Required work:

- Replace the hardcoded `CITIES` set in `app/api/account/watchlist/route.ts` with `TRACKED_MARKET_NAMES`.
- Keep auth + `isPremium` gates on both account routes.
- Make `PATCH /api/account/watchlist` accept either:
  - `{ watchlist: string[] }` for full replacement, validated to tracked markets and max 10.
  - `{ op: 'add' | 'remove', city: string }` for atomic single-city updates.
- Return `400 { error: 'watchlist_full' }` when adding an 11th city.
- Return `400` for invalid cities or malformed operations instead of silently filtering user intent.
- Return `{ ok: true, watchlist: string[] }` on success.
- Make `PATCH /api/account/alerts` accept partial patches, not require `alertPreference` when only `alertMinDiscount` or `alertTimezone` is sent.
- Preserve UI-supported discount values as 30/40/50, while the route may continue accepting 0-90 as existing backend capability.
- Import `TRACKED_MARKET_NAMES` in `app/deals/DealFeed.tsx` and delete its duplicated hardcoded city list.
- Leave `PATCH /api/onboarding` available for onboarding only; do not route account changes through it.

Acceptance tests:

- Unauthenticated account preference writes return 401.
- Non-premium account preference writes return 403.
- Adding a tracked city returns the updated watchlist.
- Removing a tracked city returns the updated watchlist.
- Adding past 10 cities returns `watchlist_full` and does not update the row.
- Full replacement rejects or truncates impossible input consistently with the route contract; prefer reject on invalid city and reject over 10 to avoid hiding mistakes.
- Alerts route accepts `{ alertPreference: 'daily' }`, `{ alertMinDiscount: 50 }`, and a combined payload.
- Alerts route rejects invalid cadence and invalid discount.
- Grep check: hardcoded city arrays are gone from `app/api/account/watchlist/route.ts` and `app/deals/DealFeed.tsx`.

### Slice 2 — Token-based email management routes

Do this before changing email templates so generated links have working targets.

Files to edit:

- `app/alerts/manage/route.ts` (new GET confirmation route)
- `app/api/alerts/manage/route.ts` (new POST mutation route)
- `app/api/alerts/manage/__tests__/route.test.ts` (new)
- `app/api/alerts/unsubscribe/route.ts`
- `app/api/alerts/unsubscribe/__tests__/route.test.ts`
- `lib/cities.ts`
- `lib/subscription.ts` only if a token lookup helper is useful; keep direct `query` usage if that is simpler and local.

Required work:

- Implement `GET /alerts/manage` as a server-rendered confirmation page. GET must never mutate.
- Implement `POST /api/alerts/manage` for token-authenticated actions:
  - `action=daily`: set `alert_preference = 'daily'`.
  - `action=stop-city`: remove the city from a non-empty watchlist.
  - Last-city stop must remove the city and set `alert_preference = 'off'` so an empty list does not silently become "all destinations."
- Validate tokens with the same UUID shape as unsubscribe.
- Validate `action` against `daily | stop-city`.
- Validate `city` using `CITY_SLUGS` and display names from `lib/cities.ts`.
- Re-check subscription state on POST and render idempotent final states for stale links.
- Update unsubscribe HTML only: keep one-click GET mutation intact, but add recovery links and real account links in success, invalid, and expired states.

Acceptance tests:

- `GET /alerts/manage` with `action=daily` renders confirmation and performs zero DB writes.
- `POST /api/alerts/manage` with `action=daily` updates only `alert_preference`.
- `GET /alerts/manage` with `action=stop-city` renders stop-city confirmation when the city is in the watchlist.
- `POST /api/alerts/manage` removes only that city when other watched cities remain.
- `POST /api/alerts/manage` removes the last city and sets alerts off.
- Invalid token/action/city renders the specified invalid-link page with an `/account#alerts` link.
- Existing `GET /api/alerts/unsubscribe` still turns alerts off in one request.
- Unsubscribe success HTML includes `Get one daily email instead` and `Manage alert settings`.

### Slice 3 — Email sender and template wiring

Do this after Slice 2 so email links are never deployed ahead of their routes.

Files to edit:

- `lib/email/sendDealAlert.ts`
- `lib/email/templates/DealAlert.tsx`
- `lib/email/sendDailyDigest.ts`
- `lib/email/templates/DailyDigest.tsx`
- `lib/email/__tests__/sendDealAlert.test.ts`
- `lib/email/__tests__/sendDailyDigest.test.ts`

Required work:

- Extend instant-alert recipient query to select `s.watchlist AS watchlist`.
- Pass `stopCityUrl` only when the recipient has a non-empty watchlist containing the deal city.
- Pass `switchDailyUrl` for every instant-alert recipient.
- Change instant and digest `manageUrl` to `${BASE_URL}/account#alerts`.
- Add the DealAlert footer line above the existing footer:
  - `Getting too many emails? Stop alerts for {city} · Switch to daily digest`
  - If `stopCityUrl` is null: `Getting too many emails? Switch to daily digest`
- Leave one-click total unsubscribe URL and placement unchanged.
- Do not add stop-city links to `DailyDigest.tsx` in this slice; the design explicitly leaves daily per-city footer actions out of scope.

Acceptance tests:

- Instant email render includes four footer links when watchlist is non-empty and contains the city.
- Instant email render omits `Stop alerts for {city}` when the recipient is in everywhere mode.
- Instant sender passes `/alerts/manage?token=...&action=stop-city&city=...` using `CITY_DISPLAY_TO_SLUG`.
- Instant sender passes `/alerts/manage?token=...&action=daily`.
- Daily digest manage URL uses `/account#alerts`; no daily stop-city link is added.

### Slice 4 — UI-only account management

Do this after Slice 1. It is visible UI work, but its writes use only the adopted account routes.

Files to edit:

- `app/account/page.tsx`
- `app/account/AccountClient.tsx`
- `app/account/__tests__/AccountClient.test.tsx` (new if test setup supports client component tests)

Required work:

- Add `id="alerts"` and `scroll-mt-20` to the premium alerts section.
- Change intro copy to: `Choose how often we email you when a deal appears. Changes save instantly.`
- Remove the panel-level `Save preferences` button and the `PATCH /api/onboarding` save path.
- Persist each control per interaction:
  - Frequency sends `PATCH /api/account/alerts` with `{ alertPreference }`.
  - Minimum deal size sends `PATCH /api/account/alerts` with `{ alertMinDiscount }`.
  - City toggle sends `PATCH /api/account/watchlist` with `{ op, city }`.
- Add per-group status lines with exactly the design copy:
  - `Saving…`
  - `Saved`
  - `Couldn’t save. Your change was undone — try again.`
  - `You’re watching 10 cities — the maximum. Unwatch one first.`
- Preserve existing visible labels:
  - `Frequency`
  - `Instant`
  - `Daily digest`
  - `Off`
  - `Minimum deal size`
  - `50%+`
  - `40%+`
  - `30%+`
  - `Cities I’m watching (n/10)`
  - `Select none to watch every destination.`
- Implement radiogroup semantics for frequency and minimum deal size.
- Use `aria-pressed` toggles for city pills.
- Replace disabled unselected city pills at 10/10 with focusable `aria-disabled` treatment so the cap reason can be discovered.

Acceptance tests:

- `/account#alerts` lands on the alerts section and does not hide the heading under the nav.
- Clicking frequency sends only `alertPreference`, not onboarding payload.
- Clicking minimum discount sends only `alertMinDiscount`, not onboarding payload.
- Clicking a city sends `{ op, city }`.
- Failed saves revert the visible state and show the group error copy.
- At 10/10, activating an unselected city shows the cap copy without a network call.
- Keyboard tab order reaches every control; arrow keys work in both radiogroups.

### Slice 5 — Watch pill on deal and destination surfaces

Do this after Slice 1 and after AccountClient is no longer the only writer.

Files to edit:

- `app/components/ui/WatchCityPill.tsx` (new)
- `app/components/ui/index.ts`
- `app/destinations/[city]/page.tsx`
- `app/deals/[dealId]/page.tsx`
- `app/components/ui/__tests__/WatchCityPill.test.tsx` (new if client component tests are available)

Required work:

- Build `WatchCityPill` with the exact prop shape from the design:
  - `city`
  - `initialWatching`
  - `initialCount`
- Render only for authenticated premium users and only when the city is in `TRACKED_MARKET_NAMES`.
- Use server-derived initial state; no client fetch-on-mount.
- Add the pill under the destination H1, before the updated-daily line.
- Add the pill below the deal-detail title block and before the price section.
- Do not render the pill in `LockedDealDetail`.
- Implement optimistic add/remove, reconcile from `{ ok, watchlist }`, revert on failure.
- Preserve exact WatchCityPill copy:
  - `Watch {city}`
  - `Watching {city}`
  - `Couldn’t update your watchlist. Try again.`
  - `You’re watching 10 cities — the maximum. Manage watchlist`
  - `You’re not watching any specific cities — alerts now cover every destination.`
- Use `aria-pressed`, `aria-busy`, and an `aria-live` status region.
- At-cap state must be focusable with `aria-disabled`, not a native disabled button.

Acceptance tests:

- Premium watched city renders `Watching {city}` on destination and deal detail pages.
- Premium unwatched city renders `Watch {city}`.
- Anonymous, free, canceled, and unknown city cases render no pill.
- Clicking add/remove sends `{ op: 'add' | 'remove', city }`.
- Last-city removal shows the every-destination copy.
- Failed request reverts state and shows error copy.
- At 10/10, activation shows the manage-watchlist copy and links to `/account#alerts`.

### Slice 6 — Deal-detail account nav

This is small and can be bundled with Slice 5, but it is independently safe.

Files to edit:

- `app/deals/[dealId]/page.tsx`
- `app/components/LandingNav.tsx` only as a source to copy the existing account icon; do not refactor it unless needed.

Required work:

- Add the account icon link to the normal unlocked deal-detail nav.
- Link target: `/account#alerts`.
- `aria-label`: `Your account`.
- Keep locked-deal nav unchanged.
- Preserve the existing `← Back to deals` link.

Acceptance tests:

- Normal deal-detail nav contains `/deals` and `/account#alerts`.
- Locked deal-detail nav does not gain the account icon.
- At 375px and 1280px the logo and right-side links fit without overlap and have 44px hit targets.

## Final copy requirements to preserve

These strings are implementation requirements, not placeholders:

- `Watch {city}`
- `Watching {city}`
- `Couldn’t update your watchlist. Try again.`
- `You’re watching 10 cities — the maximum. Manage watchlist`
- `You’re not watching any specific cities — alerts now cover every destination.`
- `Choose how often we email you when a deal appears. Changes save instantly.`
- `Saving…`
- `Saved`
- `Couldn’t save. Your change was undone — try again.`
- `You’re watching 10 cities — the maximum. Unwatch one first.`
- `Getting too many emails?`
- `Stop alerts for {city}`
- `Switch to daily digest`
- `Manage prefs`
- `Unsubscribe`
- `Switch to one daily email?`
- `Instead of an email per deal, you’ll get a single morning digest with the best new deals for your cities.`
- `Deal alerts are currently off for this address. Confirming turns them back on as a single morning digest.`
- `You’re already on the daily digest`
- `This address gets one morning email with the best new deals. Nothing to change.`
- `You’re on the daily digest`
- `One email each morning with the best new deals — no more instant alerts.`
- `Stop alerts for {City}?`
- `You’ll stop getting deal alerts for {City}. Alerts for your other watched cities keep coming.`
- `{City} is your only watched city`
- `Stopping it turns off deal alerts entirely, since you’re not watching any other cities.`
- `You’re not watching {City}`
- `This address doesn’t get city-specific alerts for {City}, so there’s nothing to stop.`
- `Done — no more {City} alerts`
- `You’ll keep getting alerts for your other watched cities. Changed your mind? You can re-add {City} anytime.`
- `Deal alerts are off`
- `We removed {City} and turned off deal alerts. Transactional account and billing emails may still be sent.`
- `This link isn’t working`
- `It may have expired or been copied incompletely. You can still manage alerts from your account settings.`
- `Something went wrong`
- `Your alert settings were not changed. Please try the link again in a minute, or use your account settings.`
- `Too much email, but don’t want to miss a real deal?`
- `Get one daily email instead`
- `Manage alert settings`

## Impossible or ambiguous requirements

- The UX design header says `02-research.md` was not produced, but `docs/pipeline/watchlist-ux/02-research.md` exists and was read. Treat the header note as stale; do not block implementation on it.
- The design names `GET /alerts/manage` plus `POST /api/alerts/manage` while also saying the implementation should mirror `app/api/alerts/unsubscribe/route.ts`. In Next App Router, use separate route handlers at those paths. Do not put a mutating POST behind the public GET URL.
- The design says the existing one-click unsubscribe URL and behavior remain byte-for-byte unchanged, but also requires new recovery HTML. Interpret "byte-for-byte" as the URL and mutation behavior only; the HTML body must change.
- `PATCH /api/account/watchlist` currently silently filters invalid full-replacement values. The design requires validation against tracked markets but does not explicitly say reject vs filter for `{ watchlist: string[] }`. Rejecting invalid or over-cap replacement input is safer and easier to test than silently changing user intent.
- The design specifies aborting previous client requests with `AbortController`. For account radiogroups, aborting is useful but not sufficient by itself; the client must also ignore stale responses so an older response cannot overwrite a later optimistic state.
- Empty watchlist means "everywhere" in existing delivery logic. In-app removal of the last city preserves that behavior and shows explanatory copy; token stop-city last-city flow intentionally differs by turning alerts off to avoid silently broadening email scope.
- UI and DEV stage split in the design is not perfectly clean: email template HTML is UI-like, but sender URL construction and token route behavior are backend. Keep template markup in Slice 3 with sender tests so links and props are changed together.

## Out of scope for this repair slice

- Per-deal saves or bookmarks.
- New cadence values such as weekly.
- Alert timezone UI.
- Daily digest per-city unsubscribe links.
- Free-user upsell controls on public deal or destination pages.
- Reordering account sections.
- Changing the existing one-click unsubscribe GET mutation to confirmation-first. It is prefetch-risky, but the design explicitly preserves it for this repair.

## Required verification before handoff

Run these after implementation, and keep both green before creating the TEST handoff:

```bash
npm exec tsc -- --noEmit --incremental false
npm test -- --passWithNoTests
```

Manual checks:

- `/account#alerts` at 375px and 1280px.
- `/destinations/cancun` with premium watched, premium unwatched, non-premium, and anonymous states.
- `/deals/{dealId}` normal unlocked state at 375px and 1280px.
- Locked deal-detail state to confirm no new account icon or watch pill.
- Instant-alert email HTML with watchlist-specific and everywhere-mode recipients.
- `/alerts/manage` GET and POST flows in a logged-out browser.
- `/api/alerts/unsubscribe` success, invalid, and expired pages.
