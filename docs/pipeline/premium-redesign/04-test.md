# TEST-PREMIUM-REDESIGN-01 — direct review

**Status:** PASS

## Checked directly

1. **Full diff read across all 12 changed files** — matches `03-design.md` Sections 2-3 precisely:
   R1 (single priority-ordered evidence resolver, grid-alignment fix), R2 (price/median/save-line
   recolored to `--ink`/`--ink-soft`, Price Verified badge and headline removed), R3 (photo wrapper
   simplified, `PropertyPhoto` card-size chrome removed, Example pill repositioned as overlay), R4
   (Geist Sans/Mono swap, `.text-tabular` applied to exactly the 5 specified fields), R5 (tracking
   indicator with correct fill math + `medianPrice <= 0` guard + `snapshotCount >= 12` opacity tier;
   `LockedDealCard` blur fully removed, redaction blocks match spec exactly).
2. **Real regression found and fixed during this review, not by the implementation pass**: the
   first implementation dropped two real side effects when collapsing 7 evidence-cue components
   into one plain-text resolver — `HotelDisruptionResultCue`'s impression-tracking analytics
   (IntersectionObserver + sessionStorage dedup firing `hotel_disruption_notice_impression`) and
   `HotelEvChargingResultSignal`'s `data-ev-charging-*` DOM attributes, which `app/deals/DealFeed.tsx`
   has its own separate observer depending on to fire `hotel_ev_charging_state_impression` for the
   whole deals feed. Confirmed via direct grep of `DealFeed.tsx` that this dependency is real, not
   speculative. Both fixed: the disruption hook was extracted into a reusable, exported
   `useHotelDisruptionResultImpression` and wired into the winning-cue `<p>`'s `ref` only when
   disruption is the actual winning cue; the EV-charging data attributes are conditionally applied
   to the same element. Verified `DepositHoldCardSignal`/`AccessibilityCardCue` have no equivalent
   hidden dependency (grepped the whole repo for any DOM-attribute or hook dependency on either —
   none found).
3. **`placeholderName` prop removal from `LockedDealCard`'s render checked for breakage**: still
   required in the type, still passed by every real call site (`app/page.tsx`, `DealFeed.tsx`,
   `/preview/dark-home`, 4 test files) — simply no longer rendered, matching the same pattern
   already used for `DealCard`'s `headline` prop. tsc's 0 errors confirms no call site broke.
4. **Independent, real verification** (rebased onto `main`, `npm install` with real network access
   — the implementation pass's own sandbox had no network access and correctly said so rather than
   faking a pass):
   - `npx tsc --noEmit --incremental false` — exit 0.
   - `npm run build` — succeeded, every route builds, Geist font loads cleanly with real network
     access to fetch it.
   - `npm test -- --passWithNoTests` — 1453 passed / 1 known pre-existing unrelated failure
     (`HotelSustainabilityCredentialEvidence.test.tsx`), matches baseline exactly.
   - A real, targeted new test was added for `PropertyPhoto`'s size-scoped chrome removal
     (confirms `card` size has no border/figcaption while `expanded` retains both) — reviewed and
     confirmed correct.
5. **`--radius-card` cascade** (43+ files reference this token, confirmed in an earlier ticket
   tonight) — this ticket's `--radius-card` value itself is unchanged; only `PropertyPhoto`'s
   `card`-size variant now *uses* that existing token instead of `--radius-control`, a narrower,
   already-audited-safe change.

## What this review does NOT and cannot verify

Same limitation as every visual change tonight — no browser was used to look at the rendered
result. The code is correct, builds, and passes every automated check, including a check for a
regression this session's own review process found and fixed rather than shipped blind. Whether it
*looks* premium is the user's call once live.

## Verdict: PASS
