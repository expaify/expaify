# TEST-ACCOUNT-REDESIGN-01 — QA

**Stage:** TEST (QA). Docs-only stage per pipeline rules — no code changed by this stage.
**Implementation reviewed:** `UI-ACCOUNT-REDESIGN-01`, produced by Codex (`codex exec --sandbox
workspace-write`), diff reviewed directly against `docs/pipeline/account-redesign/03-design.md`
(R1–R5) line by line before shipping.

## Verification run (real, in worktree `UI-ACCOUNT-REDESIGN-01`)

Codex's own sandbox has no network access, so it could not run `npm install` and reported `tsc`/
`build` as blocked by missing dependencies (`geist`, `@radix-ui/react-slot`, etc. — all already in
`package.json`, just not installed in its sandbox). Re-verified independently after a real
`npm install`:

1. `npx tsc --noEmit --incremental false` — **exit 0**, zero errors.
2. `npm test -- --passWithNoTests` — **138 passed / 1 failed, 1453 passed / 1 failed** (139/1454
   total). The one failure is the pre-existing, unrelated `HotelSustainabilityCredentialEvidence.test.tsx`
   baseline failure already present before this ticket (confirmed against the known baseline —
   nothing account-related regressed). No test file references `app/account` or `AccountClient`
   directly, so no test needed updating.
3. `npm run build` — succeeded. `/account` route present in the route manifest, no compile errors.

## Diff review against the design spec (R1–R5)

- **R1 (section order):** confirmed Plan → Alerts → Profile → Privacy in the real file. The
  `id="alerts"` scroll anchor and the `premium &&` conditional wrapper around the Alerts section
  moved intact, unmodified.
- **R2 (fixed plan-card anatomy):** real `<dl>` facts block (Plan / Price / Renewal) → callout slot
  → actions slot, present for all 4 states. Price row renders `—` in every state except `trialing`
  (`$8/mo` or `$12/mo` matching the existing plan-based logic) — no fabricated price introduced
  anywhere else, matching R2/D2's hard constraint. Tier copy uses "Premium" throughout, not "Pro" —
  the terminology correction flagged in the research stage was carried through correctly.
- **R3 (scheduled-cancellation):** the honest-interim/future-ready split was explicitly scoped as a
  separate DEV-stage ticket (the `cancel_at_period_end` data-model gap is a backend change, not a
  markup change) — correctly, nothing was fabricated in this UI-only ticket to paper over that gap.
  The pre-existing `canceled` branch (Stripe's real terminal state, post `subscription.deleted`) is
  unchanged and accurate.
- **R4 (watchlist):** `citySearch` state + `sortedFilteredCities` useMemo added, cities sorted via
  `localeCompare` and filtered case-insensitively; empty state renders "No matching cities."; the
  search input never touches `cities` (selection) state — confirmed by reading `toggleCity`,
  `persist()`, and the `cities` state declaration, all byte-identical to the pre-existing code.
- **R5 (autosave):** `StatusLine`, `persist()`, `PillRadioGroup`-equivalent button pattern all
  untouched. No page-level Save button was added anywhere in the diff.
- **Privacy section:** untouched — confirmed via diff, zero lines changed in that block.
- **Copy fidelity:** every existing visible string (trial countdown, active/canceled/free branch
  copy, "Browse live deals", etc.) is byte-identical to the pre-existing code; this was a structural
  regrouping into the facts/callout/actions anatomy, not a copy rewrite, as the spec required.
- **Accessibility:** the "Browse live deals" action link gained an explicit
  `focus-visible:outline` treatment (a real improvement, not required by the spec but consistent
  with its intent — verified it doesn't clash with the existing `.btn-outline` focus styling).

## Manual state trace

Traced all 4 plan-card states (trialing / active / canceled / free) and the watchlist
search/empty-state against the rendered JSX — all render the exact copy specified, no placeholder
text, no skipped state. Mobile (375px) and desktop (1280px) both use the same
`sm:grid-cols-3`/`sm:grid-cols-2` responsive patterns already proven elsewhere in this design
system — no new breakpoint behavior introduced.

## PASS criteria

1. tsc exits 0 — **PASS**
2. tests exit 0 modulo the known pre-existing failure — **PASS**
3. Every state from the design spec is implemented — **PASS**
4. No visual regression in adjacent surfaces (Profile, Privacy) — **PASS**, confirmed via diff
5. Mobile 375px and desktop 1280px both usable — **PASS**, existing responsive patterns reused

**Verdict: PASS.** No rollback ticket needed.
