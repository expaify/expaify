# UXD-PREMIUM-REDESIGN-DISCOVERY-01 — Discovery + Competitive Analysis

**Stage:** UXD (UX Discovery) — docs only, no code changed, no commit.
**Scope:** expaify.com homepage (`app/page.tsx`) + the shared components it repeats everywhere:
`app/components/ui/DealCard.tsx` and `app/components/ui/LockedDealCard.tsx`. These render on the
homepage hero, the homepage teaser grid, the homepage dark band, every card in `/deals`
(`app/deals/DealFeed.tsx`), every `/destinations/[city]` page, and one research harness
(`HotelEvChargingHarness.tsx`) — 12 real JSX call sites across the app (grep-verified,
`__tests__` excluded).

**Why this doc exists:** a previous redesign attempt tonight was rejected by the founder ("bro
this is trash") because it reached for generic "premium dark SaaS" references — Linear, Vercel,
`terafab.ai` — that belong to B2B tooling, not consumer travel. This stage restarts with real
research inside the actual category (travel/booking, deal-alert products specifically) and real,
compared output from multiple frontier models via Krater, rather than one model's own reasoning.

---

## 1. The problem (UX Discovery deliverable)

**One-sentence pain point:** expaify's `DealCard` — the single most-repeated surface in the
product — tries to *assert* trust through repeated badges and copy ("Price Verified," "expaify
never adds fees," up to seven stacked one-line evidence cues) instead of *demonstrating* it
through restraint and a distinctive visual mechanism, which is exactly the pattern genuinely
premium travel/deal products (Airbnb, Going, Google Flights) avoid — the result reads as a
generic coupon-aggregator dressed in a nice color palette, not a curated discovery product.

**Who's affected, and where:** every first-time visitor who lands on the homepage hero or scrolls
to the "Live deals right now" teaser grid, and every visitor browsing `/deals` or a
`/destinations/[city]` page — i.e., the entire top-of-funnel evaluation step, before signup. This
is not a booking-flow or post-booking problem; it is a first-impression/credibility problem on the
card that is the product's primary unit of trust.

**Measurable signal that the problem exists (verified directly in code, not assumed):**
- `DealCard.tsx` can stack **up to 7 conditional one-line "evidence cue" paragraphs**
  (`quietEvidenceCue`, `disruptionCue`/`HotelDisruptionResultCue`, `poolCue`, `climateCue`,
  `reviewScanLine`, `HotelEvChargingResultSignal`, `AccessibilityCardCue`,
  `DepositHoldCardSignal`) between the hotel name and the price block (`DealCard.tsx:164-238`) —
  more than triple the "3 grouped decision factors" Google Flights' own UX research settled on.
- Two separate trust-copy elements repeat the same claim in different words within one card: the
  "Price Verified" badge (`DealCard.tsx:206-217`, tooltip: *"Verified savings based on N
  independent price checks"*) and the footer line *"Based on N price checks over 60 days · expaify
  never adds fees"* (`DealCard.tsx:259-263`) — this is close to Baymard's documented pitfall #3
  (repeating the same discount/trust signal reads as two different claims, not reinforcement).
- Two accent hues (`--primary` teal + `--accent` coral, both defined in `app/globals.css`) plus a
  third `--gold` tier color compete with the price's own color (`text-[color:var(--primary)]` on
  the deal price itself, `DealCard.tsx:192`) — the price is not visually distinct from the CTA
  buttons, the "Save $X" line, or the headline, all of which also use `--primary`.
- Typography is the current-year default pairing (`--font-display: Space Grotesk`,
  `--font-sans: Inter`, `app/globals.css:5-6`) — functional, but carries no distinctive identity;
  it is the exact "safe/versatile choice" pattern this brief was told to route around.

**3 constraints the solution must respect:**
1. **Data integrity / no fabricated stats** — this codebase has a strict honesty discipline
   (confirmed repeatedly in this repo's audit history). `DEAL_THRESHOLD = 0.70` and
   `MIN_SNAPSHOTS = 8` (`lib/pipeline/dealRules.ts:9,11`) are the only numbers allowed to justify
   "deal" language; nothing shown on a card can imply confidence the underlying snapshot data
   doesn't support.
2. **Money contract** — `Money = { priceCents: number; currency: string }` everywhere, never a
   float, per `NON_NEGOTIABLE_CONTRACT` in `AGENTS.md`.
3. **Prop-contract stability** — `DealCard`/`LockedDealCard` have 12 real call sites across
   `app/page.tsx`, `app/deals/DealFeed.tsx`, and `HotelEvChargingHarness.tsx`. No required prop
   may be renamed or removed; any redesign directive has to be achievable by changing markup/CSS
   inside the component or, at most, by having upstream data selection (e.g. photo choice) prefer
   different existing fields — not by inventing new required props.

**Success statement:** *This is solved when a first-time visitor can look at any DealCard on the
homepage, `/deals`, or a `/destinations/[city]` page and read it as a considered, curated find —
not a coupon-site listing — without the card needing to tell them it's trustworthy in three
different places at once.*

---

## 2. Real competitive research (Step 1)

Gathered via live `WebSearch`/`WebFetch` — sources cited inline, all fetched during this session.
Deliberately excludes B2B/SaaS references (Linear, Vercel, `terafab.ai`) per the explicit
correction from the earlier rejected attempt; stays inside consumer travel/booking, where trust,
photography, and price clarity are the actual conversion levers.

1. **Google Flights — price-card UX**
   ([medium.com/geekculture, "A UX case study: Improving Google Flights"](https://medium.com/geekculture/a-ux-case-study-improving-google-flights-4b3b6438601d)):
   Google user-tested a directive "Today is a good day to book" banner and **rejected it** —
   users found it salesy and untrustworthy, and Google Flights' whole value proposition rests on
   trust. It uses flat, neutral color-coded price signaling instead of persuasive copy, and groups
   the top 3 decision factors (price, times, duration) in tight spatial proximity while demoting
   secondary info (connecting airports) to secondary views.

2. **Airbnb DLS (Design Language System) — ListingCard**
   ([designsystems.one/design-systems/airbnb-design](https://www.designsystems.one/design-systems/airbnb-design)):
   Core philosophy, quoted directly: *"photography is the hero, copy is restrained, the system
   stays out of the way of the listing."* `ListingCard` = photo-led, title/location/price/
   rating/availability, minimal chrome. 8px base spacing grid. One typeface (Cereal), one accent
   color (`#ff385c` Rausch). The restraint itself — not ornamentation — is what reads as premium:
   the system doesn't compete with the photo.

3. **Going (formerly Scott's Cheap Flights) — direct competitor, same category as expaify**
   (curated deal-alert product, not a generic OTA). 2023 DesignStudio rebrand
   ([bpando.org/2023/05/30](https://bpando.org/2023/05/30/branding-travel-company-going/),
   [creativeboom.com](https://www.creativeboom.com/inspiration/designstudio-completely-reimagines-scotts-cheap-flights-as-going/)):
   - Picked **PP Mori** (Pangram Pangram), a distinctive licensed typeface — not a default
     Google Fonts pairing.
   - Palette is green-led with orange/blue/purple accents tied to a specific narrative
     ("biological diversity of the four hemispheres") — the palette has a *reason*, not just
     "green because travel."
   - Deliberately moved away from posed/stock holiday photography and "bucket-list landmark"
     shots toward closeup, UGC-style imagery (patterned tiling, specific dishes, "vignettes of
     smaller moments") — because at a trust-driven price point, stock-looking imagery undermines
     the "our people actually found this deal" premise. (Critics still call out when Going's own
     site slips back into stock landmark shots — a real, current cautionary example, not a
     hypothetical.)
   - The logo/UI motion language (a reverse loop in the "G") ties back to the "reverse booking"
     product mechanism — the identity embodies the mechanism, not decoration for its own sake.
   - **Takeaway for expaify:** expaify's positioning ("we track prices, we tell you when they
     drop") is structurally identical to Going's pre-rebrand positioning. Going's insight was that
     a pure-utility deal-alert brand reads as generic/interchangeable with any coupon site *unless*
     the visual identity itself embodies the mechanism and rejects stock travel imagery.

4. **Baymard Institute — price-discount display research**
   ([baymard.com/blog/product-page-price-discounts](https://baymard.com/blog/product-page-price-discounts),
   evidence-based usability testing, cross-industry benchmark): four documented pitfalls —
   (a) discounted price not visually distinct from surrounding content (18% of sites fail this);
   (b) discount info placed too far from the base price; (c) showing the same discount signal more
   than once, which reads as two different offers; (d) showing only % *or* only $ saved instead of
   both (the "Rule of 100" — show whichever number feels larger).
   **Cross-checked against the real code:** expaify's price block already groups deal price +
   strikethrough median + `DealChip` percent + conditional "Save $X/night" in one `.space-y-2`
   block (`DealCard.tsx:190-236`) — it is **not** failing pitfalls (b) or (d). This is a genuinely
   useful negative finding: the "generic/AI-slop" complaint is almost certainly **not** about the
   price mechanics (those are sound and already evidence-aligned) — it's about surface treatment
   (typography personality, imagery, color restraint) and information density (up to 7 stacked
   evidence cues fighting the price block for attention, which is closer to pitfall (c)'s "repeated
   signal" problem and works directly against Airbnb's restraint lesson above).

5. **Kayak** (general product knowledge, current as of Aug 2026): price-forecast sits directly on
   the results card; the comparison grid is dense but flat — Kayak's premium signal is "we show
   you everything, unfiltered," not visual polish. This confirms expaify should **not** chase
   Kayak's density-as-trust model; expaify's actual differentiator (curated push alerts, not a
   self-serve search grid) is structurally closer to Going's model than Kayak's.

**What was deliberately not used:** Hopper was researched and excluded as a positive reference —
its July 2026 FTC settlement (deceptive pre-selected fees, internal emails describing the
practice as "tricking users") makes its UI patterns a trust *anti-pattern* for a product whose
whole pitch is honesty about price. Mr & Mrs Smith and Secret Escapes were searched but yielded no
verifiable card-level UI specifics beyond positioning copy, so they're noted here as ruled out for
lack of concrete, citable detail — not used as unsupported inspiration.

---

## 3. Real Krater model comparison (Step 2)

Called `https://api.krater.ai/v1/chat/completions` directly (OpenAI-compatible), same system
prompt + same detailed user prompt (embedding the research above, the real `DealCard.tsx`/
`LockedDealCard.tsx`/`app/page.tsx` source, the actual design tokens, the money/prop-contract
constraints, and the "bro this is trash" problem framing) sent to three models. Key rotation was
available (`KRATER_API_KEY`, `_2`, `_3`) but the primary key had balance for all calls.

| Model | Result | Notes |
|---|---|---|
| `openai/gpt-5.2-codex` | Complete, clean (a)/(b)/(c) response, `finish_reason: stop` | Most disciplined and implementation-ready |
| `anthropic/claude-opus-5` | Extended-thinking reasoning trace, hit `max_tokens` before emitting final formatted `content` (tried 2500 → 6000 → 4000-with-low-effort → 10000-with-low-effort token budgets; the model consistently spent its full budget on reasoning) | Reasoning trace itself is complete and highly specific through most of (a)/(b)/(c); used as source material below |
| `deepseek/deepseek-v4-pro` | Same behavior as opus-5 — reasoning trace hit `max_tokens`, cut off mid-directive-6 | Weakest of the three: visibly hedges in its own reasoning ("this is risky but might be too extreme"), and lands on a serif typeface recommendation that risks re-triggering the exact cliché this brief banned |

*(Full raw responses, including usage/cost accounting, are preserved in the session's scratchpad —
`krater_result_anthropic_claude-opus-5.json`, `krater_result_openai_gpt-5.2-codex.json`,
`krater_result_deepseek_deepseek-v4-pro.json` — not committed to the repo since this stage is
docs-only.)*

### What each model actually said

**`openai/gpt-5.2-codex`** (complete answer):
- **Problem statement:** "Expaify's DealCard erodes trust because it stacks up to seven evidence
  lines and multiple badges around the price, creating dense, salesy noise that competes with the
  photo and makes the 'deal' feel manufactured — opposite of Google Flights' neutral signaling and
  Airbnb/Going's photo-led restraint."
- **Directives:** (1) collapse evidence cues to a single "credence line" max 2 items, citing
  Google Flights + Airbnb; (2) neutral price-signal semantics — restyle the discount chip as a
  quiet status chip, remove the in-card "Price Verified" badge; (3) make the photo the primary
  anchor — increase photo height share, reduce border/chrome; (4) UGC-style image crop rules
  (4:3, subtle zoom, no vignette, no landmark stock), citing Going; (5) keep discount mechanics
  intact (citing Baymard directly) but cap the price block at two lines.
- **Application to the real component:** gave literal JSX for the collapsed credence line,
  specific Tailwind class changes (`aspect-[4/3]`, `border-[color:var(--line-white)]`), explicit
  instruction to drop the "Price Verified" in-card badge and the redundant footer line, and a
  parallel cleanup for `LockedDealCard` (drop the gold "Save %" pill and the "Deal found today"
  pill — "reads as salesy for a gated product").
- **What it didn't touch:** typography. It never proposed a type-family change, effectively
  treating the current Space Grotesk/Inter pairing as not the core problem.

**`anthropic/claude-opus-5`** (from its reasoning trace — richest and most inventive of the
three, though it never formatted a final answer):
- Independently reached the same core diagnosis as gpt-5.2-codex (evidence-cue overload, price
  color colliding with every other UI element) but went further on *mechanism*: proposed
  separating **price** (neutral ink, "to feel factual like Google Flights") from **discount
  signal** (the single chromatic accent) — directly derived from the Baymard finding that 18% of
  sites fail because a discounted price shares color with unrelated interactive elements.
- Picked a specific typeface direction (a distinctive licensed grotesque in the vein of Söhne/ABC
  Whyte, with a monospaced/tabular-figure cut specifically for prices so the deal price and
  strikethrough median align vertically) — reasoned explicitly through *why* it's avoiding the
  serif-cream cliché the brief banned, and why tabular numerals matter for a price-tracking
  product specifically.
- Proposed a genuinely original mechanism not present in any of the research inputs: since
  expaify's core mechanism is a 60-day snapshot history, render a **derived visual (a coverage/
  median bar or sparkline built from `snapshotCount` and the existing deal/median price fields —
  no new props needed)** directly on the card, so the "we tracked this for 60 days" claim is
  *shown*, not just stated in a footer sentence. This is the closest analog to Going's "identity
  embodies the mechanism" lesson applied concretely to expaify's actual data model.
- Called out the `LockedDealCard` blur treatment directly: "the blur effect on locked deals reads
  like adware" — proposed showing the *real* structure (real city, real star rating, real discount
  percent, real median price band) and redacting only the hotel name and deal price as
  correctly-sized placeholder blocks, rather than blurring the whole card.
- Proposed a hard priority order for which single evidence cue (if any) survives on the card:
  disruption > closure > climate > accessibility > quiet > reviews > EV — collapsing "up to 7
  lines" to "at most 1," matching gpt-5.2-codex's directive independently.

**`deepseek/deepseek-v4-pro`** (from its reasoning trace — most verbose, weakest synthesis
discipline):
- Reached similar structural conclusions (evidence-cue overload, single-accent-color palette,
  full-bleed photo) but with visible self-doubt in its own reasoning ("this is risky but might be
  too extreme," "not specified," second-guessing its own typeface picks multiple times).
- Landed on **Fraunces**, a high-contrast serif, as its typography recommendation — this directly
  risks re-triggering the "warm cream + serif + terracotta" cliché this brief explicitly named and
  banned, especially paired with expaify's existing warm-cream `--bg`. Weighted down for this
  reason.
- Proposed a "warm film grain overlay" on hotel photos and a hover micro-interaction where the
  discount chip "pulses" — both read as decorative flourish rather than the evidence-grounded,
  mechanism-driven specificity the other two models produced; not carried into the synthesis.
- One idea worth keeping: explicitly naming the coral accent as "an arbitrary pop that cheapens
  the feel" and proposing the palette collapse to a single accent — this corroborates (and is
  subsumed by) opus-5's price/discount color-separation directive, so it's folded in rather than
  cited standalone.

### Verdict — how the three were weighted

**gpt-5.2-codex is the structural backbone**: it's the only one of the three that actually
finished, stayed disciplined about the "no new props" constraint, and produced implementation-
literal output (real class names, real JSX). Its restraint on typography (not touching it) is
treated as a valid, considered choice, not a gap — but it's supplemented, not overridden, by
opus-5's typography reasoning below, since typography identity is one of the four things this
brief explicitly asked every model to address.

**opus-5's reasoning is used for the two most valuable ideas neither of the other two models
produced**: (1) the price/discount color-separation mechanism (which is the most precise,
directly-cited application of the Baymard finding of any of the three responses), and (2) the
snapshot-history visual mechanism and the "blur reads like adware" critique of `LockedDealCard`
— both are novel extrapolations from expaify's *actual* data model rather than generic pattern-
matching against the research, which is exactly the "specific, not vague" bar this brief set.
Despite never producing a formatted final answer, its reasoning trace is more rigorous and more
specific to this codebase than deepseek's completed-but-hedging output — so it is weighted above
deepseek despite the incomplete `finish_reason`.

**deepseek is weighted down**, not discarded: its serif/Fraunces pick is explicitly rejected (see
directive D1 below, which locks in a sans-serif direction instead), and its decorative flourishes
(film grain, hover pulse) are dropped as ungrounded. Its single-accent-color instinct is kept only
because opus-5 independently reached the same conclusion with a sharper, more specific mechanism.

This is a real synthesis across two of the three sources (gpt-5.2-codex structure + opus-5
mechanism/typography), with deepseek's contribution folded into one corroborating data point and
its weaker ideas explicitly excluded — not a coin flip and not a single model's answer taken
wholesale.

---

## 4. Final synthesized problem statement + directives

**Problem statement (final):** expaify's `DealCard` asserts trust through repetition (two
overlapping "we're honest about price" claims, up to seven stacked evidence-cue lines, three
competing accent colors) instead of demonstrating it through restraint and a visual mechanism tied
to what the product actually does — track a hotel's price for 60 days and tell you when it drops —
which is precisely the "coupon site" pattern that genuinely premium travel products (Airbnb,
Going, Google Flights) engineer away from.

**Directives (D1–D5), each traceable to a specific research finding and a specific model source:**

- **D1 — One evidence line, priority-ordered, not seven.**
  *(gpt-5.2-codex + opus-5, independently agreeing; grounded in Google Flights' "group the top 3
  decision factors, demote the rest" and Airbnb's restraint principle.)*
  Cap the card to at most one evidence-cue line below the hotel name, chosen by priority:
  disruption notice > pool/climate closure > accessibility fit > quiet-stay > review signal > EV
  charging > funds/deposit hold. All lower-priority cues move to the deal-detail page, not off a
  toggle on the card itself (a toggle adds interaction complexity a discovery card shouldn't
  carry). Remove the redundant "Based on N price checks... expaify never adds fees" footer line
  entirely — its content already exists once, correctly, near the price.

- **D2 — Separate the price's color from the discount's color.**
  *(opus-5, directly derived from Baymard finding #1: discounted prices must be visually distinct
  from surrounding elements, and expaify currently reuses `--primary` for the price, the CTA, the
  headline, and the "Save $" line all at once.)*
  The deal price itself renders in neutral ink (`--ink`), large and weighted — a fact, not a
  marketing color. `DealChip` becomes the single chromatic element in the price block, carrying
  all "this is a deal" signaling by itself. Remove the in-card "Price Verified" badge (it's a
  second, competing trust claim per Baymard pitfall #3 — the freshness/verification information
  already lives in "Price checked {time}").

- **D3 — Photo dominance, no padding wrapper, no stock-landmark bias.**
  *(gpt-5.2-codex's aspect-ratio/border directive + Going's documented rejection of stock/landmark
  photography + Airbnb's "photography is the hero.")*
  Increase the photo's share of card height; drop the current inset-padding treatment
  (`px-4 pt-3` wrapper around `PropertyPhoto`) in favor of the image running to the card's edges,
  with the card's existing radius token clipping it. Since `DealCard` only accepts a single
  `photoUrl` prop and can't add new ones, this directive applies at the data-selection layer (which
  photo the pipeline picks upstream), not the component contract: prefer interior/detail shots over
  wide exterior shots when multiple OTA photos exist. No new prop required.

- **D4 — A single licensed sans-serif system, tabular figures for all numerals, no serif.**
  *(opus-5's typography reasoning, explicitly weighted over deepseek's Fraunces/serif pick, which
  risks the exact "warm cream + serif" cliché this brief banned.)*
  Replace the Space Grotesk/Inter pairing with one distinctive, licensed grotesque family used
  system-wide (in the vein of Söhne or ABC Whyte — final pick belongs to UXDES, not this stage),
  using its tabular/mono numeral cut specifically for all prices, discount percentages, and
  snapshot counts, so the deal price and strikethrough median align vertically across every card.
  This directly answers the "generic AI-slop" complaint at the typography level without touching
  the warm-cream base palette, which stays (abandoning it now would just trade one cliché for the
  banned one).

- **D5 — Make the 60-day tracking mechanism visible, not just stated; stop blurring
  `LockedDealCard`.**
  *(opus-5's most original contribution — an extrapolation from expaify's actual data model, not
  a copy of any single reference; the strongest example in this comparison of "specific to this
  product," which the brief explicitly asked for.)*
  `DealCard` already receives `snapshotCount`, `dealPrice`, and `medianPrice` — enough to derive a
  small visual (a coverage/median indicator) showing "how far below normal, over how much history"
  without a new prop, replacing the current purely-textual "Based on N price checks" claim with
  something shown, not just said. Separately, `LockedDealCard`'s full-card blur reads as an ad unit
  rather than a premium gate; show the real city, star rating, and discount percentage un-blurred
  (all already non-sensitive), and redact only the hotel name and deal price as fixed-width
  placeholder blocks that preserve the card's real layout.

**Constraints re-confirmed against all five directives:** none require a new required prop, a
renamed export, a float for money, or any stat not already backed by real `snapshotCount`/
`discountPct`/`medianPrice`/`dealPrice` data flowing through the existing `Money` contract. D4 is
the only directive with a cost/licensing question (a licensed typeface); that decision belongs to
UXDES, not this stage.

---

## Handoff

Per pipeline rules, this UXD stage does not create the next-stage ticket itself — the calling
process does that. Next stage is `UXR-PREMIUM-REDESIGN-01` (UX Research), which should read this
doc, re-audit the current homepage/`DealCard` implementation directly (not just this summary), and
produce 3–5 specific, testable design directives building on D1–D5 above.
