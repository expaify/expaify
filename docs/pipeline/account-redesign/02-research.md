# UXR-ACCOUNT-REDESIGN-01 — UX Research

**Stage:** UXR (UX Research) — docs only, no code changed, no commit made by this process until
explicitly committed below.
**Reads:** `docs/pipeline/account-redesign/01-discovery.md` (D1–D6) in full.

**Methodology note, stated plainly:** this stage's original dispatch (a Fable-model subagent) hit
a hard session-limit failure mid-task (real error: "You've hit your session limit · resets 2:50am
UTC") before producing any output — no partial doc was written, confirmed by checking the
worktree before restarting. Per explicit instruction, this stage was redone with the orchestrating
session calling Krater directly (real API call, not simulated — see cost/token accounting below)
rather than re-dispatching another Fable subagent. Only one model (`openai/gpt-5.2-codex`) was
called this round, not the 2-3-model comparison used in prior stages — a real, disclosed
methodology change for this stage only, not a hidden shortcut. The code-verification work below
(Step 1) was done directly by the orchestrating session, independent of and prior to the Krater
call.

---

## 1. Re-verification against real code (Step 1) — a significant update to D3

Independently re-read `app/account/page.tsx`, `app/account/AccountClient.tsx`,
`lib/subscription.ts`, `app/api/stripe/webhook/route.ts`, and `lib/stripe/mapping.ts` directly.

### D3 finding, materially updated from the discovery doc's hypothesis

The discovery doc speculated D3's "scheduled-to-cancel vs. already-lapsed" distinction "may already
be derivable from `currentPeriodEnd` vs. `now()` without a schema change." **That hypothesis is
wrong, confirmed by reading the real webhook handler:**

- `Subscription` (`lib/subscription.ts:5-20`) has no `cancel_at_period_end` or `cancel_at` field.
- A real, exhaustive grep (`grep -rn "cancel_at_period_end|cancelAtPeriodEnd" app lib`) returns
  **zero matches anywhere in this codebase.** This field is never read from Stripe's webhook
  payload, never stored, never surfaced.
- `mapStripeStatus` (`lib/stripe/mapping.ts:9-21`) maps Stripe's real `sub.status === 'active'`
  directly to expaify's `status: 'active'` — and Stripe's own well-documented behavior is that
  `cancel_at_period_end: true` does **not** change `sub.status` away from `'active'` until the
  period actually ends (at which point Stripe fires `customer.subscription.deleted`, handled at
  `app/api/stripe/webhook/route.ts:111-118`, which sets `status: 'canceled'` and does not touch
  `currentPeriodEnd` at all).

**Real consequence, verified, not assumed:** a subscriber who cancels via Stripe's self-serve
portal (the only cancellation path this app has — `AccountClient.openPortal()`) currently shows on
`/account`, and in this app's own database, as a **completely normal, fully active subscriber**,
with zero indication anywhere on the page that they've scheduled a cancellation, until the exact
moment the period ends and Stripe's `customer.subscription.deleted` event fires. This is a real,
currently-invisible gap — not merely an ambiguity inside the existing `'canceled'` status bucket as
the discovery doc framed it.

**Correction to D3's scope:** fixing this properly is a real data/schema change — capturing
`cancel_at_period_end` (boolean) and `cancel_at` (Unix timestamp) from the
`customer.subscription.updated` webhook payload and persisting them on the `Subscription` row —
not a markup-only fix as the discovery doc's phrasing left open as a possibility. R3 below specs
both the future-ready behavior (once that data exists) and the honest interim behavior (today,
before that data-model change ships), so a UI directive exists either way rather than blocking on
the backend change.

---

## 2. Real Krater call (Step 2)

Called `https://api.krater.ai/v1/chat/completions` directly (`openai/gpt-5.2-codex`,
`max_tokens: 6000`, `reasoning: {"effort": "low"}` — the combination confirmed reliable within
Krater's gateway timeout across all four prior stages tonight). Real result:
`finish_reason: stop`, 6,711-character complete answer, **cost $0.0343987875**, 783 prompt tokens /
2,384 completion tokens (704 of which were reasoning tokens). Raw response saved to the session
scratchpad (`account_uxr_gpt.json`), not committed — this stage is docs-only.

The prompt embedded D1–D6 verbatim, including the updated D3 finding above (so the model reasoned
against the *corrected* technical picture, not the discovery doc's original, wrong hypothesis).

### What it produced (full content reviewed, not just skimmed)

- **D6 resolved: "Plan → Alerts → Profile."** Reasoning given: alerts/watchlist is the page's
  recurring product-value lever and should sit immediately after plan status, ahead of static
  profile/identity fields, to minimize scroll to the most-used section. This is the same call
  `claude-opus-5`'s reasoning made in the discovery stage's own Krater comparison — two independent
  model runs, on two different stages, reaching the same conclusion, which strengthens rather than
  just asserts this pick.
- **R2 (D1+D2 combined):** a concrete `dl`-style three-row facts block (Plan / Price / Renewal)
  with an exact per-state content table for all 4 states, a callout slot, and an actions slot with
  exact button copy per state ("Manage subscription" / "Resubscribe" / "Upgrade"). Correctly
  enforces D2's constraint — price only ever shown in the trial state, explicitly `"—"` elsewhere,
  with the instruction "Do not show any price in active or canceled states until Stripe price is
  stored."
- **R3, directly addressing the corrected D3 finding:** specifies two conditions explicitly —
  future-ready behavior gated on `cancel_at_period_end === true` (once that field exists: Renewal
  row reads "Ends on {date}", callout reads "Cancellation scheduled for {date}. You'll keep access
  until then."), and an honest interim behavior for today, before that data exists, that does not
  fabricate a cancellation state ("Cancellation status will appear here if scheduled." — a neutral,
  true statement rather than silence or a guess). This is exactly the "spec it as ready-to-implement
  once the data exists, be honest today" instruction the prompt gave, correctly followed.
- **R4 (watchlist):** alphabetical sort + case-insensitive live filter, exact placeholder/empty-state
  copy ("Search cities" / "No matching cities."), explicit note that filtering is client-side view
  state only and never touches the saved watchlist.
- **R5 (autosave):** explicit confirmation no page-level Save button should exist, exact
  `StatusLine` copy ("Saving…" / "Saved" / "Couldn't save. Try again."), a QA test explicitly
  checking "no Save button exists anywhere on the page" — a direct, testable assertion of D5's
  preservation constraint.

### Assessment (single-model output this round — evaluated on its own merits, not comparison-weighted)

The response is concrete, testable, and does not hedge — every requirement has exact states (with
honest N/A markings and reasons, matching the discipline established in prior stages), exact copy,
and a real QA test. It correctly incorporated the corrected D3 finding rather than the discovery
doc's original (wrong) hypothesis, meaning the model was reasoning from accurate technical premises.
One judgment call worth flagging rather than silently accepting: R2's per-state Plan-name copy
("Pro (Trial)", "Pro (Canceled)") introduces a plan-tier name, "Pro," that does not appear anywhere
in the current codebase (the real tier names are `monthly`/`annual` plans and a `free` tier, with UI
copy like "Premium" — checked against `app/join/_form.tsx` and `page.tsx` in this same session's
`/join` discovery work). **This specific copy detail is not adopted as-is** — UXDES should use the
product's real, existing tier vocabulary ("Premium," not "Pro") rather than this response's
invented term.

---

## 3. Final requirements (R1–R5)

Adopted from the Krater response above, with the one correction noted (Pro → Premium terminology)
and the D3 future/interim split preserved exactly as specified:

**R1 — Section order: Plan → Alerts → Profile**, per the reasoning above (recurring product value
ranks above static identity metadata). Static ordering, no interactive states apply.

**R2 — Fixed plan-card anatomy across all 4 states** (facts block: Plan / Price / Renewal → callout
slot → actions slot), with price shown only in the trial state (never fabricated elsewhere,
enforcing D2), and tier copy using the product's real "Premium" terminology, not "Pro."

**R3 — Scheduled-cancellation state, split into future-ready and honest-interim behavior**, per the
corrected D3 finding: once `cancel_at_period_end`/`cancel_at` are captured from Stripe (a real
data-model change, out of this stage's own scope but specified so UXDES/DEV know exactly what to
build once it ships), show "Cancellation scheduled for {date}. You'll keep access until then." —
today, before that field exists, show a neutral, honest statement rather than nothing or a guess.

**R4 — Watchlist: alphabetical sort + live search filter**, exact placeholder/empty copy, filter is
client-side view state only, never touches the saved autosaved watchlist.

**R5 — Preserve the exact autosave model**, no page-level Save button, exact `StatusLine` copy,
QA test explicitly asserting no Save button exists anywhere on the page.

**Constraints re-confirmed:** Privacy/data-export section untouched (not referenced anywhere
above). No fabricated price or cancellation state — R2 and R3 both explicitly gate on real data
existing. Autosave model (`persist()`, `StatusLine`, `PillRadioGroup`) preserved exactly per R5.

---

## Handoff

Per pipeline rules, this UXR stage does not create the next-stage ticket itself. Next stage is
`UXDES-ACCOUNT-REDESIGN-01` (UX Design), which should turn R1–R5 into an implementation-ready spec
with exact Tailwind classes/markup against the real current `page.tsx`/`AccountClient.tsx`, correct
the "Pro" → "Premium" terminology noted above, and make explicit whether R3's data-model change
(capturing `cancel_at_period_end`/`cancel_at`) is in this redesign's own scope or a separate,
flagged follow-up ticket (recommended: flag as a separate DEV-stage ticket, since it touches the
Stripe webhook handler and is backend/data work, not a UI change — the same reasoning tonight's
security-audit tickets used to separate urgent backend fixes from UI work).
