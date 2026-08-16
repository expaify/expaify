# UXR-PREMIUM-REDESIGN-01 — UX Research

**Stage:** UXR (UX Research) — docs only, no code changed, no commit.
**Reads:** `docs/pipeline/premium-redesign/01-discovery.md` (UXD-PREMIUM-REDESIGN-DISCOVERY-01,
directives D1–D5).
**Produces:** 3–5 specific, testable design requirements for UXDES to turn into a full spec.

---

## 1. Re-verification of the current implementation (Step 1)

Per this stage's mandate, the code was re-read directly from the repo just now — not assumed from
Stage 1's line-number citations, which can drift. Findings below confirm Stage 1's numbers are
still accurate, with two corrections that matter for how precise the Stage 2 requirements can be.

### `app/components/ui/DealCard.tsx` — confirmed accurate, one positional correction

- The evidence-cue stack between the hotel-name block and the price block is, today, exactly
  **7 possible lines**: `reviewScanLine` (164–168) → `HotelDisruptionResultCue` (169) →
  `quietEvidenceCue` (170–174) → `poolCue` (175–179) → `climateCue` (180–184) →
  `HotelEvChargingResultSignal` (185) → `AccessibilityCardCue` (188, sibling right after the
  `<div>` closes, still before the price block at 190). Stage 1's "up to 7" figure is exactly
  right.
- **Correction to Stage 1:** Stage 1's evidence-cue list also names `DepositHoldCardSignal` as an
  eighth cue type, and its directive D1 puts "funds/deposit hold" at the bottom of the single
  priority list — but `DepositHoldCardSignal` does **not** currently render in the same location
  as the other seven. It renders at line 238, **after** the price block (190–236) closes, right
  before the CTA/footer. It is not part of today's "stacked before the price" problem at all — it
  is a separate, single-instance cue near the bottom of the card. This matters: if D1's unified
  priority list ever selects `DepositHoldCardSignal` as the one surviving cue, it has to be *moved*
  up to the hotel-name-adjacent slot, not just left in place with everything above it removed. None
  of the three Krater model responses below caught this positional detail; it's folded into the
  final directives.
- `showVerifiedBadge` (125–130) has logic Stage 1's doc doesn't mention: it requires
  `snapshotCount >= 12`, `discountPct >= 15`, **and** `isFresh` (`updatedAt` within 36 hours) —
  labeled in-code as a "Trust Resolution Gate." This is a real, existing confidence tier already
  built into the badge condition. It's directly useful for D5/D2 below: the redesign can reuse this
  exact threshold logic for a lower-vs-full-confidence treatment instead of inventing a new one.
- The "Price Verified" badge tooltip/aria text (206–217) and the footer line (259–263) are
  character-for-character what Stage 1 quoted. Confirmed.
- `DealChip` (`DealChip.tsx`, read in full) uses `bg-[color:var(--gold)]` /
  `text-[color:var(--gold-text)]` — it does **not** currently share `--primary` with the price. The
  only elements sharing `--primary` today are: deal price (192), headline (221), "Save $X/night"
  (224), the "Price Verified" badge icon/text (208–213), and the "View deal" CTA border/text (242).
  So D2's real job is separating *those five* from `--primary`, not separating price from
  `DealChip` — they were never colliding. Confirmed as accurate in Stage 1, just making the exact
  scope explicit for the requirements below.

### `app/components/ui/LockedDealCard.tsx` — confirmed accurate

Full-card blur confirmed: photo at `blur-[6px]` (57), name/meta/price/comparison rows all at
`blur-[5px]` (69, 75, 87) inside `pointer-events-none select-none` wrappers. City (`placeholderCity`)
and star rating are *already* inside the blurred block today (70–74) — contrary to a literal
reading of D5, they are not currently shown unblurred; that's real net-new work, not a small tweak.
`discountPct` is already unblurred (it's in the top-right "Save X%" pill, 43–46, outside any blur
wrapper) and in the aria-label (40). Confirmed: `stars`, `discountPct`, `placeholderCity`,
`placeholderName` are all existing props — every D5 requirement below is achievable with zero new
props on `LockedDealCard`, exactly as Stage 1 required.

### `lib/pipeline/dealRules.ts` — confirmed exact

`DEAL_THRESHOLD = 0.70`, `EXPIRE_THRESHOLD = 0.85`, `MIN_SNAPSHOTS = 8`. Unchanged from Stage 1's
citation. These remain the only real numbers usable to justify any "deal" or "confidence" language.

### `app/globals.css` — confirmed, plus one relevant precedent found

Token values (`--primary: #0E5A54`, `--accent: #FF6B4A`, `--gold: #D9A441`, `--font-display`:
Space Grotesk, `--font-sans`: Inter) all confirmed exact. The seven-step type scale
(`.text-caption` 11.5px … `.text-display` 40/52px) is confirmed as "the only font sizes in the
product" per the file's own comment.

One thing **not** in Stage 1's doc, found during re-verification: `globals.css` also contains an
isolated `.theme-dark-preview` scope (lines ~531–863) used only by `app/preview/dark-home/page.tsx`
— output of a separate, already-completed initiative (`docs/pipeline/dark-homepage-prototype/`,
its own D1–D7 numbering, unrelated to this one). It's not part of this feature and doesn't touch
the light-theme production surface this stage is scoped to. It is mentioned here only because it
proves a real, working technique already in this codebase: applying elevation/border overrides to
`DealCard`/`LockedDealCard` from an ancestor scope (`.theme-dark-preview main article`,
`.theme-dark-preview main a[aria-label^="Locked premium deal"]`) *without* editing the component
files. That's relevant precedent if UXDES wants a route-scoped variant later, but it does not
satisfy any D1–D5 directive on its own — it's a different, dark-theme-only route.

---

## 2. Real Krater multi-model comparison (Step 2)

Called `https://api.krater.ai/v1/chat/completions` directly, same pattern as Stage 1: one detailed
system+user prompt (embedding the real current code above, D1–D5 verbatim, the money/prop-contract
constraints, and this stage's actual job — turn D1–D5 into 3–5 testable requirements with exact
states/hierarchy/interaction/copy) sent to the same three models Stage 1 used. All raw
request/response JSON is preserved in the session scratchpad (not committed — this stage is
docs-only): `req_gpt4.json`/`resp_gpt4.json`, `req_opus2.json`/`resp_opus2.json`,
`req_ds2.json`/`resp_ds2.json`, plus the failed intermediate attempts below.

### What actually happened, call by call

| # | Model | max_tokens | reasoning effort | Result | Wall time | Cost |
|---|---|---|---|---|---|---|
| 1 | `openai/gpt-5.2-codex` | 8000 | default | Gateway `502 ROUTER_EXTERNAL_TARGET_ERROR` | 120.2s | unknown/unbilled |
| 2 | `openai/gpt-5.2-codex` | 4000 | default | `finish_reason: length` — spent all 3968 completion tokens on reasoning, `content: null` | 110.4s | $0.0657 |
| 3 | `openai/gpt-5.2-codex` | 12000 | low | Gateway `502` (exceeded gateway's ~120s window) | 120.2s | unknown/unbilled |
| 4 | `openai/gpt-5.2-codex` | **6000** | **low** | **Complete.** `finish_reason: stop`, real 10,998-char answer, 2176 reasoning + ~2821 content tokens | 97.1s | $0.0799 |
| 5 | `anthropic/claude-opus-5` | 8000 | default | Gateway `502` | 120.2s | unknown/unbilled |
| 6 | `anthropic/claude-opus-5` | 6000 | low | `finish_reason: length` — all 6000 tokens spent on reasoning, `content: null` | 90.2s | $0.1978 |
| 7 | `anthropic/claude-opus-5` | 8000 | low | Gateway `502` (exceeded gateway window) | 120.2s | unknown/unbilled |
| 8 | `deepseek/deepseek-v4-pro` | 8000 | default | Gateway `502` | 120.3s | unknown/unbilled |
| 9 | `deepseek/deepseek-v4-pro` | 6000 | low | `finish_reason: length` — all 6000 tokens spent on reasoning (25,707 chars of trace), `content: null` | 84.9s | $0.0048 |

**Pattern found (worth recording since it differs slightly from Stage 1's account):** Krater's own
gateway appears to hard-timeout around 120s regardless of the client's `--max-time`. `gpt-5.2-codex`
only fits inside that window *and* leaves room for a real answer at a narrow `max_tokens: 6000` +
`reasoning: {"effort": "low"}` combination — one token higher (8000, even at low effort) pushes
generation time past the gateway's own timeout before it can finish, producing a `502` instead of a
usable "ran out of budget" response. `claude-opus-5` and `deepseek-v4-pro` both need *more* than
6000 reasoning tokens to even finish thinking through this prompt (confirmed by both cutting off
mid-thought, not mid-answer, at the 6000-token low-effort setting), which — combined with the same
~120s gateway ceiling — means there is no `max_tokens` value in the space this session could reach
where either model both (a) finishes reasoning and (b) still fits under the gateway timeout. This
is a materially identical failure mode to what Stage 1 reported (same two models, same "spends its
full budget thinking" behavior), just hitting a slightly different wall (gateway timeout, not only
`max_tokens`) — consistent enough that it's treated as the same finding, not a new one. Total real
spend across the four calls that returned a billed response: **≈$0.348**.

### What each model actually said

**`openai/gpt-5.2-codex`** (complete, 10,998-char answer, verbatim structure preserved):

Produced exactly 5 numbered requirements, one per directive, each with a "Directives," "Elements
touched," "Exact behavior & hierarchy," "States," "Copy changes," "Interaction rules," and "How
this is testable" subsection — i.e., it independently used almost the exact rubric this stage's
prompt asked for, unprompted with a template. Highlights:
- **R1 (D1):** explicit 7-item priority list identical to D1's own ordering, explicit rule that
  pool-vs-climate ties go to pool, explicit "no placeholder when empty" state, explicit removal of
  the footer line.
- **R2 (D2):** reclassifies headline and "Save $X/night" from `--primary` to `--ink-soft` (not just
  removing the badge) — this is more thorough than D2's own text, which only explicitly mentioned
  the badge and the price itself.
- **R3 (D3):** concrete Tailwind removal (`px-4 pt-3` wrapper gone, `w-full`, rely on the article's
  existing `overflow-hidden` for clipping) — directly implementable, no invented classes.
- **R4 (D4):** a concrete, testable rule for tabular figures: apply to deal price, median,
  discount %, snapshot count, "Save $X/night," and "/ night" — the only response of the three to
  enumerate the exact fields, not just say "prices."
- **R5 (D5):** a specific bar-and-dot design (track = full width, fill % =
  `dealPrice/medianPrice`, median marker at 100%, deal marker at fill end) plus a specific
  redaction spec for `LockedDealCard` (fixed pixel dimensions for the name and price blocks: 18px
  tall/70% wide for name, 28px tall/64px wide for price).
- **What it didn't address as rigorously:** its D5 visual doesn't reference `MIN_SNAPSHOTS`/
  `DEAL_THRESHOLD` at all — it shows the ratio but not a confidence/coverage tier, which is the
  part of D5's brief ("how far below normal, over how much history") this response answers only
  half of (the "how far below normal" half, not "over how much history").

**`anthropic/claude-opus-5`** (reasoning trace only, both attempts hit the token ceiling before
emitting formatted output — used as source material per this stage's explicit instruction, same as
Stage 1):

The trace is dense and inventive despite never reaching final formatted content:
- Independently proposed a **"chromatic budget" rule**: at most two chromatic accents per card
  (gold `DealChip` + one other, e.g., the teal CTA), with severity/warning states communicated by
  icon + text rather than color alone once it flagged that `--accent-text` coral fails WCAG at body
  text size on `--surface`. This is a more precise, accessibility-grounded version of D2 than
  either D2's own text or gpt-5.2-codex's answer.
- Proposed **dropping the `headline` field from the card entirely**, moving it to the detail page,
  reasoning that it duplicates what `DealChip` already communicates — a stronger read of D1's
  restraint principle than gpt-5.2-codex's answer, which kept `headline` on-card (just recolored).
- Designed the D5 tracking visual as a **range bar bounded by the actual math**: because deals only
  flag at `ratio ≤ DEAL_THRESHOLD` (0.70), the fill will *always* be ≤70% of the track — explicitly
  called out as "honest and deterministic," i.e., derivable from real data with no invented scale.
  This is more rigorous than gpt-5.2-codex's version, which didn't ground the bar's bounds in
  `DEAL_THRESHOLD` at all.
- Proposed **reusing the existing `showVerifiedBadge` confidence gate** (the `snapshotCount`/
  `discountPct`/freshness thresholds found during this stage's own re-verification above, not
  present in Stage 1's doc) as an opacity tier for the tracking visual: 8–11 snapshots → 60%
  opacity ("sparse history" signal), 12+ → full opacity — directly answers the "over how much
  history" half of D5 that gpt-5.2-codex's response left unaddressed.
- Was mid-way through designing the exact evidence-cue resolver function (tie-breaking rules
  between pool/climate, tone taxonomy limited to "neutral"/"attention") when it ran out of budget —
  incomplete, but the completed portion is directly usable.

**`deepseek/deepseek-v4-pro`** (reasoning trace only, 25,707 chars, most verbose of the three, ran
out of budget mid-way through drafting D1's evidence-copy rules — didn't reach a final typography
pick this run, unlike Stage 1's run, which reported it landing on a serif "Fraunces" recommendation
before cutting off; this run cut off earlier, before making that call):

- Visible, extensive hedging throughout ("Need maybe...", "Hmm...", re-deciding the same question
  multiple times) — confirms Stage 1's characterization of this model as the weakest synthesis
  discipline of the three, independent of this run's different cutoff point.
- Independently reached the same range-bar concept as `claude-opus-5` for D5 (ratio of
  `dealPrice`/`medianPrice` on a track), arriving at it through more back-and-forth and explicitly
  rejecting a fabricated "per-day price history" visualization because the codebase only has
  snapshot *counts*, not snapshot *dates* — a real, correct, load-bearing observation about data
  availability that neither other model raised, and directly relevant: any D5 spec that implies a
  literal 60-day timeline/sparkline (as Stage 1's own doc suggested — "a coverage/median bar or
  sparkline") would not be fully backed by the fields `DealCard` actually receives. This is folded
  into the final directives below as a real constraint.
- For D5/`LockedDealCard`, independently arrived at "fixed-width placeholder blocks for name and
  price only, real city/stars/discount visible" — matching D1's text almost exactly, adding the
  concrete implementation note that current call sites don't pass a real hotel name to
  `LockedDealCard` at all (only `placeholderName`), so "showing the real name" was never actually
  on the table — only the *redaction treatment* changes, not what data flows in. This is a real,
  correct catch worth keeping.
- No unique typography or interaction-rule contribution reached before cutoff.

### Verdict — how the three were weighted

**`gpt-5.2-codex` is the structural backbone**, same role it played in Stage 1: it's the only
response that actually finished, and its rubric (directive mapping → elements touched → hierarchy →
states → copy → interaction → testability) is used as the literal section structure for the final
directives below, because it's a better fit for "testable requirements" than Stage 1's own
narrative format. Its weaknesses — not grounding the D5 bar in `DEAL_THRESHOLD`, not addressing
"how much history," keeping `headline` on-card — are specifically patched using `claude-opus-5`'s
reasoning, not left as-is.

**`claude-opus-5`'s incomplete trace supplies the three ideas neither of the other two reached**:
the chromatic-budget rule (grounded in a real contrast-ratio problem with `--accent-text`), the
`DEAL_THRESHOLD`-bounded range bar, and reusing the existing `showVerifiedBadge` confidence-gate
thresholds as the "how much history" opacity tier. All three are concrete, data-grounded, and
directly answer parts of D2/D5 the other two responses left thin. Despite never producing formatted
output (same failure mode as Stage 1, now understood to be a Krater gateway-timeout interaction,
not purely a `max_tokens` problem), it is weighted above `deepseek-v4-pro`.

**`deepseek-v4-pro` is weighted lowest but not discarded**, same as Stage 1: no unique design
direction survived to inform the final directives, but its one substantive, correct catch — that
`DealCard`/`LockedDealCard` only have snapshot *counts*, not snapshot *dates*, so a literal
timeline/sparkline visualization (which Stage 1's own D5 text floated as an option) is not fully
data-backed — is real and is used to rule out the sparkline option below in favor of the
`DEAL_THRESHOLD`-bounded range bar both other models converged on independently. Its `LockedDealCard`
observation (call sites never pass a real hotel name in the first place) is also kept.

This is a genuine three-way synthesis: gpt-5.2-codex's structure, opus-5's two most specific
mechanisms plus its accessibility catch, deepseek's one correct data-availability constraint — not
a coin flip, and not one model's answer taken wholesale.

---

## 3. Final synthesized design requirements (Step 2 deliverable)

Five requirements, each mapped to D1–D5, each specifying exact states/hierarchy/interaction/copy,
each independently testable by QA with no ambiguity.

### R1 — One evidence line, strict priority, footer removed
**Operationalizes:** D1.

- **Hierarchy on this part of the card:** hotel name (primary) → star/city/check-in meta line
  (secondary) → at most one evidence line (tertiary, optional).
- **Selection rule (exclusive, exactly one line renders, or none):** disruption notice
  (`HotelDisruptionResultCue`) → pool/climate closure (pool wins if both present) → accessibility
  fit (`AccessibilityCardCue`, only if not expired) → quiet-stay (`getQuietEvidenceResultCue`) →
  review signal (`getGuestReviewScanLine`) → EV charging (`HotelEvChargingResultSignal`, excluding
  the unknown state) → funds/deposit hold (`DepositHoldCardSignal`).
- **Positional correction (from this stage's own re-verification, not from any model):**
  `DepositHoldCardSignal` currently renders after the price block (line 238), not adjacent to the
  other six cues. If it is the selected cue, it must render in the same slot as the others (directly
  below the meta line) — it cannot be left at its current position with everything else above it
  simply removed.
- **States:** *default* — one line, or nothing, based on the priority rule above; no other state
  applies (evidence is synchronous prop data, not fetched — no loading/error state exists for this
  element). *Empty* — when no evidence source returns a value, render nothing (no placeholder text,
  no empty-state copy).
- **Interaction:** none — the evidence line is static text; it does not intercept the card's
  existing click-through behavior.
- **Copy removed (exact, delete entirely, all conditions):** "Based on {snapshotCount} price checks
  over 60 days · expaify never adds fees".
- **Copy for the surviving line:** unchanged — pass through whatever the winning helper function
  already returns (`getHotelDisruptionResultCue`, `getHotelPoolCardSummary().copy`, etc.); this
  stage does not invent new evidence copy, only the selection/positioning rule.
- **Testable by QA:** feed a fixture with 3+ simultaneous evidence sources present (e.g.
  disruption + quiet-stay + review) → exactly one line renders, and it is the disruption line.
  Feed a fixture with only `fundsPolicy` present → exactly one line renders, in the position
  directly below the meta line, not after the price block. Feed a fixture with zero evidence
  sources → zero evidence lines render, and the footer sentence never renders under any condition.

### R2 — Neutral price ink; `DealChip` + one CTA are the card's only two chromatic elements
**Operationalizes:** D2.

- **Hierarchy in the price block:** deal price (primary, `--ink`, large/weighted) → `/ night` +
  strikethrough median (secondary, `--ink-faint`) → `DealChip` (tertiary but the block's *only*
  color) → "Price checked {time}" (tertiary, `--ink-soft`).
- **Chromatic budget rule (from `claude-opus-5`'s reasoning, the most precise of the three
  responses on this point):** at most two chromatic (non-neutral) elements are visible on any
  single card at once: `DealChip`'s gold, and the "View deal" CTA's teal. Every other element that
  currently uses `--primary` — the deal price (192), `headline` (221), "Save $X/night" (224), and
  the "Price Verified" badge (206–217) — must not.
- **`headline` field:** removed from the card (moved to the deal-detail page). It duplicates what
  `DealChip`'s percentage already communicates, and keeping it on-card while also recoloring it
  reintroduces a second, quieter version of the "two claims for one fact" problem D1/D2 are both
  trying to remove. `DealCard` keeps receiving the `headline` field (no prop removed — the contract
  stays intact), it is simply not rendered inside `DealCard`.
- **"Price Verified" badge:** removed entirely (all conditions, including when
  `showVerifiedBadge` would currently be true). Its confidence signal is absorbed into R5's
  tracking indicator below via the same existing threshold logic (`snapshotCount >= 12`,
  `discountPct >= 15`, `isFresh`), not lost.
- **"Save $X/night" line:** kept (it is genuinely useful, distinct information — the absolute $ to
  complement `DealChip`'s %), but recolored to `text-[color:var(--ink-soft)]`, not `--primary`.
- **States:** *default* — colors as specified above. *Hover/focus* — no color change to the price
  block itself (card-level hover elevation is unaffected by this requirement). *Loading/error* —
  not applicable; price data is always present when the card renders (no skeleton price state
  exists today and this requirement doesn't add one). *Empty* — `DealChip` already returns `null`
  when `discountPct <= 0` (confirmed in `DealChip.tsx`); this requirement doesn't change that.
- **Interaction:** none of these elements are independently interactive; the whole card remains one
  click target via the existing absolutely-positioned overlay `<a>`.
- **Copy:** no strings change text, only color. `DealChip`'s copy stays "−{discountPct}% vs usual."
- **Testable by QA:** render a card meeting every `showVerifiedBadge` condition today
  (`snapshotCount: 12, discountPct: 15, updatedAt: <1h ago`) → confirm no "Price Verified" badge
  renders under any props combination. Inspect computed color of the deal price, headline (if any
  test fixture still passes one through — confirm it's simply not rendered), and "Save $X/night"
  text → none resolve to `--primary` (`#0E5A54`). Confirm exactly two distinct non-neutral colors
  appear on a fully-populated card: `--gold` and `--primary` (CTA only).

### R3 — Photo runs edge-to-edge, no padding wrapper
**Operationalizes:** D3.

- **Layout change:** remove the `px-4 pt-3` wrapper div (`DealCard.tsx:142`) around
  `<PropertyPhoto>`; the photo becomes the article's first direct child, `w-full`, clipped by the
  article's existing `overflow-hidden` + `rounded-[var(--radius-card)]` — no new clipping mechanism
  needed since both already exist on the parent `<article>`.
- **Hierarchy:** photo becomes the single largest visual element on the card, ahead of the hotel
  name/price block, matching Airbnb's "photography is the hero" principle cited in Stage 1.
- **Data-selection layer (not a component change):** per D3 and the "no new prop" constraint, this
  requirement only reaches the actual photo choice via whichever upstream code currently populates
  `deal.photoUrl` — that selection logic is out of this component's scope and out of this stage's
  scope (D3 explicitly defers it), but the requirement here is: whatever photo is chosen, `DealCard`
  itself must display it edge-to-edge, not inset.
- **States:** *default* — edge-to-edge image. *Loading* — unchanged: `photoLoading` prop
  (`'eager' | 'lazy'`) continues to control the underlying `<img>` loading strategy exactly as
  today; this requirement doesn't touch that logic. *Empty* (`photoUrl` undefined) — whatever
  fallback `PropertyPhoto` renders today for a missing `src` must also run edge-to-edge, not
  revert to the inset treatment. *Hover/focus* — unchanged; if `PropertyPhoto` has no existing
  hover treatment, this requirement doesn't add one (out of scope — a hover zoom/treatment is a
  UXDES decision, not specified here to avoid inventing new interaction not grounded in any of D1–D5
  or the model outputs).
- **Interaction:** none — photo is not independently clickable; the whole-card overlay link is
  unaffected by removing the padding wrapper.
- **Copy:** none.
- **Testable by QA:** inspect the rendered DOM — `<PropertyPhoto>` is `article`'s first child with
  no intervening padded wrapper; the rendered image's bounding box touches the article's left/right
  edges at every breakpoint tested (375px, 1280px); the "Example" mock-data pill (`DealCard.tsx:
  144–146`) — currently inside the removed padding wrapper — must be repositioned as an overlay on
  top of the now-edge-to-edge photo (e.g. absolutely positioned, top-left) rather than disappearing;
  this is a real, concrete consequence of removing the wrapper that none of the three model
  responses flagged, since none were shown the `deal.isMock` branch's dependency on that wrapper.

### R4 — Single sans-serif system, tabular figures on a named field list
**Operationalizes:** D4.

- **Typeface rule:** one licensed grotesque family, used for both what are today `--font-display`
  (Space Grotesk) and `--font-sans` (Inter) — i.e., the display/body split is retired in favor of a
  single family at multiple weights. No serif under any circumstance (explicitly ruling out
  `deepseek-v4-pro`'s Stage-1-reported "Fraunces" direction, which risks the "warm cream + serif"
  cliché this whole initiative exists to avoid). Final family selection is UXDES's call, not this
  stage's, per D4.
- **Tabular-figure field list (exact, from `gpt-5.2-codex`'s response — the only one of the three to
  enumerate fields rather than say "prices" generically):** `deal.dealPrice`, `deal.medianPrice`,
  `deal.discountPct` (in `DealChip`), `deal.snapshotCount` (in R5's tracking indicator), the
  computed "Save $X/night" amount. CSS requirement: `font-variant-numeric: tabular-nums` (plus the
  `"tnum"` OpenType feature if the chosen family supports it) applied to exactly these fields, not
  every numeral on the page (e.g., not the star-rating count, which is glyph-rendered via
  `starChars()`, not a numeral).
- **Weight rule:** reuse the existing 7-step type scale (`.text-caption` 11.5px …
  `.text-display` 40/52px) rather than inventing new sizes, per the constraint that these are "the
  only font sizes in the product." Hotel name and `DealChip` stay at weight 700 (bold); deal price
  stays at weight 600 (`.text-h2`'s existing weight) — "large and weighted" is satisfied by size +
  the existing 600 weight, not a manufactured 700/800 override that would fight the type scale's own
  rule against off-scale values.
- **Fallback stack:** `[licensed family], -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
  Helvetica, Arial, sans-serif`.
- **States:** not applicable — typography doesn't vary by interaction state.
- **Interaction:** none.
- **Copy:** none.
- **Testable by QA:** render two cards with different price magnitudes (e.g. $89 and $1,240) side
  by side — digit glyph widths are visually uniform (tabular), confirmed via computed
  `font-variant-numeric: tabular-nums` on both. Confirm zero `<h1>`–`<p>` elements resolve to a serif
  `font-family` in computed styles. Confirm the star-rating string is unaffected by the tabular rule
  (it's not a numeral).

### R5 — Visible 60-day tracking indicator (bounded by real thresholds); `LockedDealCard` redaction replaces full blur
**Operationalizes:** D5 (and absorbs the "Price Verified" confidence signal removed in R2).

**Part A — `DealCard` tracking indicator, replaces the deleted footer line:**
- **Visual:** a single horizontal range bar, not a per-day sparkline. `deepseek-v4-pro`'s
  reasoning correctly identified that `DealCard` receives `snapshotCount` (a count) but no
  per-snapshot dates — a literal 60-day timeline/sparkline (which Stage 1's own D5 text floated as
  one option) would visually imply daily granularity the data doesn't support. The bar instead
  encodes exactly what the real fields support: track = 100% width representing `medianPrice`; fill
  = `(dealPrice.priceCents / medianPrice.priceCents) * 100%`. Per `claude-opus-5`'s reasoning, this
  fill is mathematically guaranteed to be ≤70% for every card that reaches "flagged" status at all
  (`DEAL_THRESHOLD = 0.70`), so the bar's visual bound is a direct, honest consequence of real
  pipeline logic, not an invented scale.
- **Confidence tier (opacity), reusing the exact existing gate instead of a new one:** bar + label
  render at 60% opacity when `snapshotCount` is between `MIN_SNAPSHOTS` (8) and 11 inclusive; 100%
  opacity at `snapshotCount >= 12` — the same threshold `showVerifiedBadge` already used
  (`DealCard.tsx:125–130`) before R2 removed that badge. This directly answers the "over how much
  history" half of D5 that neither model fully closed on its own.
- **Label copy (exact, tabular figures per R4):** "Tracked 60 days · {snapshotCount} checks" —
  e.g. "Tracked 60 days · 14 checks."
- **Accessibility:** the bar is `role="img"` with
  `aria-label="{dealPrice formatted} is {discountPct}% below the 60-day median of {medianPrice
  formatted}, based on {snapshotCount} price checks."` — fully derivable from existing props, no
  fabrication.
- **States:** *default* — bar + label as above. *Below `MIN_SNAPSHOTS`* — this state cannot occur
  in production: `evaluateDeal()` in `dealRules.ts` already forces `action: 'expire'` for any deal
  with `snapshotCount < 8`, so a flagged/active `DealCard` can never render with fewer than 8
  snapshots. The indicator therefore never needs a "not enough data" fallback — documenting this
  explicitly (rather than silently omitting the state) satisfies this stage's instruction to name
  every state and say why it doesn't apply when it doesn't. *Mock data* (`deal.isMock`) — indicator
  does not render, matching the existing pattern where mock cards already skip the (now-removed)
  footer trust line. *Expired* — does not render (matches existing `deal.expired` grayscale
  treatment, which already suppresses the footer line today).
- **Interaction:** none — static, non-interactive.

**Part B — `LockedDealCard`: remove full-card blur, redact only name + price**
- **Un-blurred (already non-sensitive, confirmed against real props):** `placeholderCity`, `stars`
  (star-rating glyphs), `discountPct` (already unblurred today in the top-right pill — unchanged),
  and the photo itself (currently at `blur-[6px]`/`blur-[4px]` on hover — both removed).
- **Correction found during this stage's own re-verification (not from any model):**
  `placeholderCity` and `stars` are *currently* inside the blurred block (`LockedDealCard.tsx:
  69–74`), contrary to a literal reading of D5's phrasing ("show the real city, star rating... "
  implying it's just being made visible) — unblurring them is real, net-new work: remove the
  `blur-[5px]` class from that specific `<div>` (69), not a no-op.
- **Redacted (fixed-width placeholder blocks, replacing the current blurred real elements):**
  hotel-name line → `h-5 w-3/5 rounded-[6px] bg-[color:var(--line-ivory)]`; deal-price row → one
  `h-8 w-28 rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]` block (the current three
  separate placeholder bars at lines 77–79 collapse into this single block, since there is no real
  `dealPrice` value passed into `LockedDealCard` today to justify multiple differently-sized bars —
  `deepseek-v4-pro`'s reasoning correctly caught that no call site currently passes a real hotel
  name or price into this component at all, only `placeholderName`/no price field, so this is purely
  a redaction *treatment* change, not a data-flow change).
- **"Premium Only" center overlay badge, "Members"/"Deal found today" pills, top-right "Save X%"
  pill:** unchanged, all copy identical to today.
- **States:** *default* — no blur anywhere; city/stars/photo/discount all crisp; name/price
  redacted as fixed blocks. *Hover* — existing `border-[color:var(--gold-deep)]` +
  `shadow-card-hover` + `-translate-y-1` treatment is unchanged; the redaction blocks do not
  animate on hover (no shimmer/pulse — keeping this static avoids the "decorative flourish"
  `deepseek-v4-pro`'s Stage-1 run was weighted down for). *Focus (keyboard)* — existing
  `focus-visible:ring-2 focus-visible:ring-[color:var(--gold-deep)]` is unchanged.
  *`accessibilityNeedsSelected`* — existing conditional caption ("Accessibility fit available after
  this deal is unlocked.") is unchanged, still un-blurred (it already isn't blurred today).
- **Copy — updated aria-label (exact, since the underlying element it describes changed):**
  current: `"Locked premium deal. Save {discountPct}% at a hotel in {placeholderCity}. Unlock deal
  with Premium."` — unchanged; it never referenced the blur, name, or price, so it remains accurate
  without edits.
- **Interaction:** unchanged — whole component is one `<a>` to `trackingHref(joinHref,
  discountPct)`, `onClick` fires the existing `track('click_card_teaser_unlock', ...)` analytics
  call, both untouched.
- **Testable by QA:** render `LockedDealCard` with fixture props → confirm zero elements have any
  `blur-*` class; confirm city text and star glyphs are legible (not `aria-hidden`, not
  `pointer-events-none select-none blur-*`); confirm exactly two placeholder blocks exist (name,
  price) each `aria-hidden="true"`; confirm the aria-label on the outer `<a>` is unchanged
  character-for-character from today's value.

---

## Constraints re-confirmed against all five requirements

- No new required prop on `DealCard` or `LockedDealCard` in any requirement above — R1–R5 all use
  only fields already on `DealCardDeal`/`LockedDealCardProps` (confirmed against the real type
  definitions read in Step 1: `hotelName, city, stars, photoUrl, dealPrice, medianPrice,
  discountPct, checkInWindow, snapshotCount, headline, fundsPolicy` for `DealCard`;
  `placeholderName, placeholderCity, stars, discountPct, photoUrl, joinHref,
  accessibilityNeedsSelected` for `LockedDealCard`).
- Money stays `{ priceCents: number; currency: string }` throughout — R2's and R5's price
  comparisons operate on `.priceCents` directly (as the current `savings` calculation already
  does at `DealCard.tsx:117`), never a formatted or floated value.
- No fabricated stats: R5's confidence tier reuses `MIN_SNAPSHOTS`/the existing
  `showVerifiedBadge` thresholds verbatim; the range bar's ≤70% bound is a real consequence of
  `DEAL_THRESHOLD`, not an invented number; the sparkline option was explicitly rejected because
  the data (`snapshotCount` only, no per-snapshot dates) doesn't support it.
- This stage produced a document only — no file under `app/`, `lib/`, or `components/` was
  modified.

## Handoff

Per pipeline rules, this UXR stage does not create the next-stage ticket itself. Next stage is
`UXDES-PREMIUM-REDESIGN-01` (UX Design), which should read this doc and produce a full design spec
covering every state (default/loading/empty/error/mobile 375px/desktop 1280px/focus-keyboard) for
R1–R5 above, including the final licensed-typeface pick deferred by R4.
