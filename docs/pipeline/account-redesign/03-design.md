# UXDES-ACCOUNT-REDESIGN-01 — UX Design Spec

**Stage:** UXDES (UX Design) — docs only, no code changed, no commit made by this process until
explicitly committed below.
**Reads:** `docs/pipeline/account-redesign/02-research.md` (R1–R5) in full.

**Methodology note:** same as the research stage — Fable is unavailable (session limit until
2:50am UTC), so this stage was done via direct Krater orchestration by the coordinating session,
not a dispatched subagent. One real Krater call was made for the plan-card section (the most
complex part); it hit `finish_reason: length` partway through the smaller watchlist-filter section
(real cost so far: $0.086, 6,000/6,000 completion tokens used). Rather than spend a second full
call re-deriving the same content, the coordinating session completed the remaining, simpler
watchlist-filter spec directly, using the real current code as source — and caught a real bug in
the Krater draft's cut-off watchlist code while doing so (see §3).

---

## 1. Plan-card section (R1, R2, R3) — from the real Krater response, verified against real code

Real call: `openai/gpt-5.2-codex`, `max_tokens: 6000`, `reasoning: {"effort": "low"}`,
`finish_reason: length` (completed this section in full before running out of budget), cost
$0.0860, 4,416 reasoning tokens. Raw response saved to session scratchpad
(`account_uxdes_gpt.json`), not committed.

Replace the entire `{/* Plan status */}` `<section>` in `app/account/page.tsx` (currently the block
starting at the `<h1>Account</h1>` sibling) with:

```tsx
{/* Plan status */}
<section
  className={`mb-5 rounded-[var(--radius-card)] p-6 ${
    premium
      ? 'border-2 border-[color:var(--primary)] bg-[color:var(--surface)]'
      : 'border-[1.5px] border-dashed border-[color:var(--line-ivory)] bg-[color:var(--surface)]'
  }`}
>
  {/* Facts block (R2) */}
  <dl className="mb-4 grid gap-4 sm:grid-cols-3">
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">
        Plan
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
        {sub?.status === 'trialing'
          ? 'Premium trial'
          : premium
          ? 'Premium'
          : sub?.status === 'canceled'
          ? 'Premium (canceled)'
          : 'Free plan'}
      </dd>
    </div>

    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">
        Price
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
        {sub?.status === 'trialing'
          ? sub?.plan === 'annual' ? '$8/mo' : '$12/mo'
          : '—'}
      </dd>
    </div>

    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">
        Renewal
      </dt>
      <dd className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
        {sub?.status === 'trialing' && sub.trialEndsAt
          ? `Trial ends ${formatDate(sub.trialEndsAt)}`
          : sub?.status === 'active' && sub.currentPeriodEnd
          ? `Renews ${formatDate(sub.currentPeriodEnd)}`
          : sub?.status === 'canceled' && sub.currentPeriodEnd
          ? `Access ends ${formatDate(sub.currentPeriodEnd)}`
          : '—'}
      </dd>
    </div>
  </dl>

  {/* Callout slot (R2 + R3) */}
  <div className="mb-4">
    {sub?.status === 'trialing' && sub.trialEndsAt && daysLeft !== null && (
      <div className="flex items-center gap-4 rounded-[var(--radius-control)] border border-[color:var(--gold)] bg-[color:var(--warning-soft)] px-4 py-3">
        <div className="shrink-0 text-center">
          <div className="text-h2 text-[color:var(--gold-text)]">{daysLeft}</div>
          <div className="text-caption font-medium uppercase tracking-wide text-[color:var(--gold-text)]">
            {daysLeft === 1 ? 'day' : 'days'} left
          </div>
        </div>
        <p className="text-small text-[color:var(--gold-text)]">
          Trial ends <strong>{formatDate(sub.trialEndsAt)}</strong>. You&apos;ll be charged{' '}
          {sub.plan === 'annual' ? '$8/mo' : '$12/mo'} unless you cancel before then.
        </p>
      </div>
    )}

    {sub?.status === 'canceled' && sub.currentPeriodEnd && (
      <p className="text-sm text-[color:var(--ink-soft)]">
        Premium access ends <strong>{formatDate(sub.currentPeriodEnd)}</strong>. Renew to keep getting alerts.
      </p>
    )}

    {(!sub || sub.status === 'free') && (
      <div>
        {activeDealCount > 3 && (
          <div className="mb-3 rounded-[var(--radius-control)] border border-[color:var(--primary-soft)] bg-[color:var(--primary-soft)] px-4 py-3">
            <p className="text-sm text-[color:var(--primary)]">
              <strong>{activeDealCount} hotel deals</strong> live right now — you can see 3.
              Upgrade to unlock all of them.
            </p>
          </div>
        )}
        <p className="text-sm text-[color:var(--ink-soft)]">
          Free plan gives you 3 unlocked deals. Upgrade for unlimited deals + email alerts.
        </p>
      </div>
    )}
  </div>

  {/* Actions slot */}
  <div className="mt-4 flex flex-wrap items-center gap-3">
    {premium && (
      <a
        href="/deals"
        className="btn btn-outline self-start focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--primary)] focus-visible:outline-offset-2"
      >
        Browse live deals
      </a>
    )}
    {premium || sub?.status === 'canceled' ? (
      <AccountClient stripeCustomerId={sub?.stripeCustomerId} userId={session.user.id} />
    ) : (
      <AccountClient userId={session.user.id} upgradePlan="annual" />
    )}
  </div>
</section>
```

**R3 explicitly confirmed not fabricated:** no `cancel_at_period_end` state is referenced anywhere
above — the canceled-state copy is byte-identical to what's live today ("Premium access ends
{date}. Renew to keep getting alerts."), which is already honest given today's real data. The
future-ready scheduled-cancellation state from R3 is **out of this ticket's scope** — see §4 for
the explicit follow-up ticket recommendation.

**State coverage:**
- *Default* — as specified per the 4-state conditional logic above (trialing/active/canceled/free),
  identical branching to the live code, only the markup structure changed (facts block replaces the
  old ad-hoc badge-only header).
- *Focus-visible (keyboard)* — the "Browse live deals" link gains an explicit focus ring
  (`focus-visible:outline` + `--primary` color); the `AccountClient` button's focus state is
  unchanged (out of this section's scope, handled by its own component).
- *Mobile 375px* — `dl` uses `grid gap-4` with no explicit column count below `sm:` (640px), so it
  stacks to a single column automatically (Tailwind's default `grid` behavior without an explicit
  `grid-cols-*`) — Plan/Price/Renewal render as 3 stacked rows, each full width, at 375px.
- *Desktop 1280px* — `sm:grid-cols-3` (active well below 1280px) renders the 3 facts side by side
  in one row.
- *Loading/Error* — not applicable; `sub` is resolved server-side before this component renders
  (confirmed: `page.tsx` is an async Server Component, `sub` is already-fetched data by the time
  this JSX runs), no client-side loading state exists for the plan card itself.

---

## 2. Watchlist search + filter (R4) — completed directly, correcting a real bug in the cut-off Krater draft

The Krater response was cut off (`finish_reason: length`) partway through this section, and the
partial draft it did produce contained a real bug: it referenced `city.name` as if
`TRACKED_MARKET_NAMES` were an array of objects. **Verified directly against the real code**
(`lib/trackedMarkets.ts`, imported at `AccountClient.tsx:6`): `TRACKED_MARKET_NAMES` is a flat
`string[]` (confirmed by its real usage at `AccountClient.tsx:346`,
`TRACKED_MARKET_NAMES.map(city => ...)` where `city` is used directly as a string, e.g.
`cities.includes(city)`). The spec below uses the real shape, not the draft's incorrect one.

Add a search input directly above the existing pill-wrap `<div>` in the Watchlist block
(`AccountClient.tsx`, inside the `{/* Watchlist */}` section, currently starting at the "Cities I'm
watching" label):

```tsx
{/* Watchlist */}
<div>
  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[color:var(--ink-faint)]">
    Cities I&apos;m watching ({cities.length}/10)
  </p>
  <input
    type="text"
    value={citySearch}
    onChange={e => setCitySearch(e.target.value)}
    placeholder="Search cities"
    className="mb-2 w-full rounded-[var(--radius-control)] border border-[color:var(--line-ivory)] bg-white px-3 py-2 text-xs text-[color:var(--ink)] placeholder:text-[color:var(--ink-faint)] focus:border-[color:var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-soft)]"
  />
  <div className="flex flex-wrap gap-2">
    {sortedFilteredCities.length === 0 ? (
      <p className="text-xs text-[color:var(--ink-faint)]">No matching cities.</p>
    ) : (
      sortedFilteredCities.map(city => {
        const selected = cities.includes(city)
        const capped = !selected && atCap
        return (
          <button
            key={city}
            type="button"
            onClick={() => toggleCity(city)}
            aria-pressed={selected}
            aria-disabled={capped || undefined}
            className={`rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium transition-colors duration-100 ${
              capped ? 'opacity-55' : ''
            } ${
              selected
                ? 'bg-[color:var(--primary)] text-white'
                : 'border border-[color:var(--line-ivory)] bg-white text-[color:var(--ink)] hover:border-[color:var(--primary-soft)]'
            }`}
          >
            {city}
          </button>
        )
      })
    )}
  </div>
  <StatusLine status={groupStatus.city} />
  <p className="mt-1 text-xs text-[color:var(--ink-faint)]">
    Select none to watch every destination.
  </p>
</div>
```

**New local state/derived value needed** (add near the existing `cities`/`atCap` state in
`AccountClient`, no prop change):

```tsx
const [citySearch, setCitySearch] = useState('')
const sortedFilteredCities = useMemo(
  () =>
    [...TRACKED_MARKET_NAMES]
      .sort((a, b) => a.localeCompare(b))
      .filter(city => city.toLowerCase().includes(citySearch.trim().toLowerCase())),
  [citySearch],
)
```

(`useMemo` — check `AccountClient.tsx`'s existing imports from `'react'` and add `useMemo` if not
already imported; `TRACKED_MARKET_NAMES` is already imported at line 6.)

**Confirmed: this is purely client-side view state.** `citySearch` never touches `persist()`,
`toggleCity()`, or any network call — filtering only changes which pills are *visible*, never which
are *selected* (`cities`, the actual autosaved watchlist, is untouched by search). Sort happens
before filter (alphabetical order is stable regardless of search text).

**State coverage:**
- *Default* — full sorted list, no search text.
- *Filtering* — list narrows live as `citySearch` changes, already-selected cities can scroll out of
  view while filtered (not pinned — R4 as specified in the research stage did not require pinning,
  unlike a richer version considered and explicitly not adopted in the earlier DealCard-adjacent
  redesign work; keeping this simpler for `/account` is consistent with this page's much smaller,
  20-item list versus a scenario that would need pinning).
- *Empty (no matches)* — "No matching cities." renders in place of the pill grid.
- *Focus (keyboard)* — standard text input focus ring via the existing `focus:ring-2
  focus:ring-[color:var(--primary-soft)]` pattern already used elsewhere in this file.
- *Mobile 375px* — input is `w-full`, pills wrap via the existing `flex-wrap` — unchanged responsive
  behavior from today, just with fewer/more pills visible depending on filter text.
- *Desktop 1280px* — same, more horizontal room for pills before wrapping.

---

## 3. R5 confirmation — zero markup change required

Re-confirmed directly against the real code: `persist()`, `StatusLine`, and the existing
`PillRadioGroup` usages (Frequency, Minimum deal size) are untouched by anything in this spec — the
watchlist's own `toggleCity()`/`persist()` call (`AccountClient.tsx:258`) is not modified, only
wrapped with the new client-side search/sort layer above it. No page-level Save button is
introduced anywhere in this spec.

---

## 4. Section order (R1) and explicit scope notes

**R1 (Plan → Alerts → Profile):** implementing this means reordering the JSX composition in
`page.tsx`/wherever these three sections are assembled — this spec does not include the exact
reorder diff since it depends on the real current assembly order which the UI-implementation stage
should confirm directly (the plan-card markup above is unaffected by section order, it's a
self-contained block either way).

**Explicit recommendation, not in this ticket's scope:** R3's future-ready scheduled-cancellation
state requires capturing `cancel_at_period_end`/`cancel_at` from the Stripe webhook — a backend
data-model change (`app/api/stripe/webhook/route.ts`, `lib/stripe/mapping.ts`,
`lib/subscription.ts`). Recommend filing this as a separate `DEV-*` ticket once this UI-only ticket
ships, consistent with how tonight's security-audit findings were split into their own DEV tickets
rather than bundled into unrelated UI work.

---

## Handoff

Per pipeline rules, this stage does not create the next-stage ticket itself. Next stage is
`UI-ACCOUNT-REDESIGN-01` (implementation): apply §1 and §2's exact diffs to `app/account/page.tsx`
and `app/account/AccountClient.tsx`, implement R1's section reorder, run
`npx tsc --noEmit --incremental false` and `npm test -- --passWithNoTests`, and check for any
existing test asserting on the old plan-card markup (grep `__tests__` for account-related
snapshots) before finishing.
