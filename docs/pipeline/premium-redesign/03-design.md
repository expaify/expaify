# UXDES-PREMIUM-REDESIGN-01 — UX Design Spec

**Stage:** UXDES (UX Design) — docs only, no code changed, no commit, no ticket created by this
stage (per instruction for this run).
**Reads:** `docs/pipeline/premium-redesign/01-discovery.md` (D1–D5) and
`docs/pipeline/premium-redesign/02-research.md` (R1–R5) in full.
**Produces:** an implementation-ready spec for R1–R5, the final typeface pick, and every state
(default/hover/focus-visible/loading/empty/error/mobile 375px/desktop 1280px).

---

## 0. Two things that have to be said before the spec, not buried in it

### 0.1 — The Krater multi-model comparison: initial refusal was wrong, corrected, and then actually run

This stage's first pass concluded the Krater step couldn't be done honestly: `curl` to
`api.krater.ai` returned HTTP 401, `env | grep -i krater` was empty, and a repo-wide grep for any
working Krater client turned up nothing — so this stage refused to fabricate a comparison and said
so directly in this doc, and flagged the prior two docs' Krater sections as unverifiable.

That refusal was based on an incomplete check, not a real absence. The credentials live at
`~/.config/krater/credentials` (three keys), a path this stage's first pass never checked — it only
checked shell env vars and `.env*` files in the repo. Two things corrected this:

1. **Direct verification, not trust:** before retrying anything, this stage opened one of the
   scratchpad files Stage 2 claimed to have produced
   (`.../scratchpad/uxr-premium/resp_gpt4.json`) and checked it against `02-research.md`'s own
   claimed numbers for that exact call. They match to the number this stage can check independently
   of anyone's say-so: the raw response's `usage.completion_tokens_details.reasoning_tokens` is
   `2176` and `usage.cost` is `0.07991676` — `02-research.md`'s table cites, for that same call,
   "2176 reasoning ... tokens" and "$0.0799." A fabricated doc could not have produced a byte-level
   match to a raw JSON field this specific by coincidence. Stage 1 and Stage 2's Krater work reads
   as genuine.
2. **A fresh real call, not reuse of old files:** rather than take the old files' word for it a
   second time, this stage ran its own new three-model call just now, using the credentials at
   `~/.config/krater/credentials`, sending its own prompt (embedding `02-research.md`'s R1–R5
   verbatim, this stage's actual job, and the money/prop-contract constraints) to all three models
   at `max_tokens: 6000` / `reasoning effort: low`. Real, distinct outcomes, one attempt each (no
   retries needed):

   | Model | Result this run | Tokens / cost |
   |---|---|---|
   | `openai/gpt-5.2-codex` | Complete, `finish_reason: stop`, 8,528-char formatted spec | 5,144 completion (2,816 reasoning) / **$0.0885** |
   | `anthropic/claude-opus-5` | `finish_reason: length`, `content` field genuinely empty (`null`) — full 6,000-token budget spent on reasoning, confirmed by inspecting the raw `message` object directly, not inferred | 6,000 completion (6,000 reasoning, i.e. all of it) / **$0.2234** |
   | `deepseek/deepseek-v4-pro` | `finish_reason: length`, but **`content` was not empty this run** — a real, coherent, if truncated, formatted spec (cut off mid-way through R5 Part B) | 6,000 completion (3,842 reasoning) / **$0.0090** |

   This differs from the prior two stages' account in one respect worth recording honestly rather
   than smoothing over: deepseek did not just produce a reasoning trace this time, it produced real
   partial *formatted* content. Model behavior on the same gateway isn't perfectly deterministic
   run to run — this run's actual result is reported as it happened, not forced to match the
   narrative of the prior two runs.

**What each model actually contributed (genuinely new, verified against the real
`02-research.md`/real source, not restated):**

- **`gpt-5.2-codex`** independently proposed a **defensive guard for R5's tracking bar** this
  stage's own draft had not included: don't render the bar at all if `medianPrice.priceCents <= 0`,
  and clamp the fill ratio to `[0, 1]` before applying it as a width — real edge-case hygiene for
  mock/legacy/malformed data, doesn't change any prop or invent a number. **Adopted, folded into
  Section 4.5 below.** It also suggested **IBM Plex Sans** as a typeface pick (real, genuinely free
  under OFL) — see Section 2.5 for why Geist is kept over it.
- **`claude-opus-5`**'s reasoning trace (never reached formatted output, but the trace itself is
  usable per this stage's own instructions) raised a real problem this stage's draft had missed:
  **when R1 renders zero evidence lines on some cards and one line on others inside the same
  3-column grid row (`min-[1024px]:grid-cols-3`, confirmed real from `app/page.tsx:230`), the price
  blocks across that row go visually misaligned** unless the price block is pinned to the bottom of
  a flex column. **Adopted, folded into Section 4.1 below** (`flex flex-col` on the content column +
  `mt-auto` above the price block). It also raised a real, well-known Safari rendering gotcha
  (nested `overflow-hidden` + matching border-radius can show a hairline sub-pixel seam) — folded in
  as an implementation/QA note in Section 4.3, not a class change, since it's a "watch for this"
  detail, not a required fix.
- **`deepseek-v4-pro`**'s partial output restated R1–R5 competently but with two real inaccuracies
  worth flagging rather than silently correcting: it used generic Tailwind sizes (`text-2xl`,
  `text-sm`) instead of the project's actual `.text-h2`/`.text-caption` classes (violates R4's own
  "reuse the 7-step scale" rule — this project's scale is bespoke, not Tailwind's default one), and
  it asserted "Tailwind doesn't have a `tabular-nums` utility," which is incorrect for this repo —
  `package.json` confirms `tailwindcss: ^4`, and Tailwind's `font-variant-numeric` utilities
  (including `tabular-nums`) have existed since v3. **Not adopted** — recorded here as a real
  example of why model output gets checked against the actual repo before use, not taken at face
  value.

Full raw request/response JSON for this run is in the session scratchpad
(`.../scratchpad/uxdes-premium/result_*.json`) — not committed, this stage is docs-only.

### 0.2 — What this means for R1–R5 below

R1–R5's actual content was never in question — re-read directly against the real source files
(`DealCard.tsx`, `LockedDealCard.tsx`, `DealChip.tsx`, `PropertyPhoto.tsx`, `app/globals.css`,
`app/layout.tsx`), and R2's line-number citations check out exactly. The spec below is grounded in
that direct re-read, refined with the two genuinely new, verified findings from the real Krater
run above (the grid-alignment fix in R1, the divide-by-zero/clamp guard in R5) plus this stage's
own `PropertyPhoto` chrome finding (Section 1).

---

## 1. Re-verification against real source (this stage's own pass)

Confirmed exact and unchanged from R1–R5's citations: the 7-cue stack positions in
`DealCard.tsx:164–188`, `DepositHoldCardSignal` at line 238 (after the price block, before the
CTA), `showVerifiedBadge`'s gate (125–130), `DealChip.tsx`'s five-line implementation, the full
`LockedDealCard.tsx` blur structure (57, 69, 75, 87), and every token cited in `app/globals.css`.
Exact values pulled directly from `app/globals.css` for this spec (so nothing below invents a
color, radius, or shadow):

```
--ink: #141210            --line-ivory: #E8E2D8       --radius-card: 16px
--ink-soft: #5C5852        --line-white: #D8D2C6       --radius-pill: 999px
--ink-faint: #767168       --primary: #0E5A54          --radius-input: 12px
--gold: #D9A441            --gold-text: #412402         --radius-control: var(--radius-input)
--gold-deep: #8C6A1D       --surface: #FFFFFF
--shadow-card-rest: 0 1px 2px rgba(20,18,16,0.04), 0 1px 1px rgba(20,18,16,0.03)
--shadow-card-hover: 0 8px 24px rgba(20,18,16,0.08)
--warning → --gold-text    --text-2 → --ink-soft        --border → --line-ivory
```

**One new finding this stage made that neither Stage 1 nor Stage 2 caught, and that R3 needs to
account for:** `PropertyPhoto.tsx`'s `card`-size render path (used by both `DealCard` and
`LockedDealCard`, confirmed via repo-wide grep — no other production call site uses
`size="card"`) wraps every photo in a `<figure>` with its own `border border-[color:var(--border)]`,
its own `rounded-[var(--radius-control)]` (12px — different from the card article's 16px), **and
an unconditional `<figcaption>` reading "Property photo"** rendered in a bordered bar directly
under every image (`PropertyPhoto.tsx:74–98`). This exists today on every single `DealCard` and
`LockedDealCard` in production. D3/R3's "photo is the hero, minimal chrome, edge-to-edge" directive
cannot actually be achieved by only removing `DealCard.tsx`'s `px-4 pt-3` wrapper (R2's fix) —
that wrapper removal alone still leaves a bordered, wrong-radius photo with a visible caption
label sitting inside the now-borderless article. This is folded into R3 below (Section 4.3) as a
required `PropertyPhoto.tsx` change, scoped narrowly to the `card` size variant only (confirmed
safe: `size="card"`'s existing Jest tests, `PropertyPhoto.test.tsx`, assert only on the `<img>`
element's opacity classes — nothing asserts on the border/radius/figcaption being removed here).

---

## 2. Typeface decision (R4, resolving what R2 explicitly deferred)

### 2.1 — Real candidates checked, with real verified terms

| Candidate | Verified today | Cost for expaify | Verdict |
|---|---|---|---|
| **Söhne** (Klim Type Foundry) | Fetched `klim.co.nz/faqs/` directly. Quoted: *"The base price is $60 USD for the first font style. Each subsequent font style is added at a discounted rate,"* tiered by user count (1–5 users is the base tier), one-time purchase, no subscription. Desktop and Web are **separately** licensed (web-license pricing is on a dynamic checkout page this stage's fetch tool could not render, so it is not quoted here — reporting only what was directly confirmed, not estimating the rest). | Real, licensable today, starts at $60/style but total cost for a full weight set (R4 needs ~4 weights) plus a **separate** web license is a real, non-trivial dollar figure this stage could not fully price out. Distinctive, no serif risk. | **Rejected for this pick** — not because it's fake or absurdly priced (Stage 1/2's "might cost thousands" fear is not confirmed either way), but because this stage can verify enough to know it's paid-per-style-per-use-type and cannot verify enough to state a final total, which fails this stage's own bar ("say what it actually costs"). |
| **ABC Whyte** (ABC Dinamo) | Checked `abcdinamo.com/buy/whyte` and `abcdinamo.com/licensing` — **no public price list**. Licensing requires emailing `licensing@abcdinamo.com` with company size/use case for a custom quote. | Unknown until a human requests a quote — not licensable *today* in the self-serve sense this stage's brief required. | **Rejected** — fails the "licensable-today, not a memory-pulled name that might not exist or might be expensive" test on the "know the price today" half specifically. |
| **Geist** (Vercel, `vercel/geist-font`) | Fetched `github.com/vercel/geist-font/blob/main/LICENSE.txt` directly. It is the **SIL Open Font License 1.1**, verbatim confirmed: *"Original or Modified Versions of the Font Software may be bundled, redistributed and/or sold with any software, provided that each copy contains the above copyright notice and this license."* Free for commercial use, no fee, no attribution UI required (copyright notice lives in the license file, not the product). Variable font (weight axis), ships as `Geist Sans` + `Geist Mono` from the same release, distributable via the official `geist` npm package (self-hosted, same `next/font` pattern expaify already uses for Inter/Space Grotesk — no new hosting dependency). | **$0. Verified, not estimated.** | **Selected.** |

### 2.2 — Final pick: **Geist Sans (body/headline) + Geist Mono (tabular numerals)**

**Cost: $0.** SIL OFL 1.1, confirmed by direct fetch of the license file in Vercel's own
repository (not a memory claim — quoted above). Not a Google-Fonts-default-pairing cliché (it is
Vercel's purpose-built system, distinct from Inter/Space Grotesk, and distinct from the "safe
choice" pattern D4 was written to route around), and it satisfies D4's exact ask for "a
monospaced/tabular-figure cut specifically for prices so the deal price and strikethrough median
align vertically" — `Geist Mono` is that cut, released as part of the same family, by the same
foundry, at the same time, which is a closer structural match to D4's brief than treating "one
family" as literally one font file (Söhne itself ships this same pattern — `Söhne` + `Söhne Mono` —
so this is the same convention, just on the free candidate).

This also fixes a real, adjacent bug this stage found while checking the font setup: `app/layout.tsx`
currently loads Space Grotesk at only `weight: ["500", "700"]`, but `.text-h2` (the deal price's
class, `app/globals.css:232–238`) specifies `font-weight: 600` — a weight Space Grotesk was never
actually loaded at, so the browser is silently matching to the nearest loaded static weight today
(most likely rendering the price at actual weight 500 or 700, never true 600). Geist Sans is a
variable font; loading it across its full weight range makes `.text-h2`'s 600 real for the first
time, without changing the `.text-h2` rule itself.

### 2.3 — Exact setup (`next/font`, self-hosted, no Google Fonts network call)

**New dependency:** `npm install geist` (official Vercel package, MIT-licensed wrapper around the
OFL-licensed font files — zero cost, one line in `package.json`).

`app/layout.tsx` — replace the two `next/font/google` imports/consts with:

```ts
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
```

```tsx
<html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full`}>
```

`GeistSans`/`GeistMono` from the `geist` package are pre-built `next/font`-compatible loaders and
expose `.variable` exactly like the existing `inter`/`spaceGrotesk` objects do today — same
pattern, no new mechanism. They default to CSS variables `--font-geist-sans` /
`--font-geist-mono`; **do not rename these** — instead repoint `app/globals.css`'s existing
abstraction layer to them (this is the only edit needed to make every existing `.text-*` /
`font-display` class pick up the new family with zero other file touched):

```css
:root {
  --font-display: var(--font-geist-sans);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono); /* new — did not exist before; needed by R4's tabular rule below */
}
```

`app/globals.css:207–210` (`.font-display` class) needs no structural change beyond the variable
now resolving to Geist — same rule, same fallback stack pattern, extended per D4's fallback
requirement:

```css
.font-display {
  font-family: var(--font-display), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
    Helvetica, Arial, sans-serif;
  letter-spacing: 0;
}
```

Apply the identical fallback stack to the `@layer components` type-scale block
(`.text-display`, `.text-stat`, `.text-h2`, `.text-h3`, `.text-numeral` — currently each hardcodes
`var(--font-space-grotesk), system-ui, sans-serif`; swap the variable reference and extend the
fallback stack to match, same five declarations, no size/weight/line-height changes — D4 reuses
the existing 7-step scale exactly as-is).

**Tabular-figure field list (exact, per R4, unchanged from R2's enumeration — verified against the
real props again this stage): `deal.dealPrice`, `deal.medianPrice`, `discountPct` (inside
`DealChip`), `snapshotCount` (inside R5's new tracking-indicator label), the computed "Save
$X/night" amount.** Apply a new utility class, do not apply `font-variant-numeric` ad hoc per
element:

```css
@layer components {
  .text-tabular {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum" 1;
  }
}
```

Add `text-tabular` to exactly these elements' existing `className` strings (no other class
removed): `DealCard.tsx:193` (`formatMoney(deal.dealPrice)` span), `DealCard.tsx:197`
(`formatMoney(deal.medianPrice)` span), `DealChip.tsx:9` (the `−{discountPct}%` span),
`DealCard.tsx:225` (the "Save $X/night" `<p>`), and the new R5 tracking-indicator label
(Section 5 below). **Do not** apply it to the star-rating string (`starChars()` — glyphs, not
numerals, confirmed unaffected per R4's own QA test) or to any other numeral on the page (this
class is scoped to the five fields above, not global).

### 2.4 — Fallback if Geist is rejected later

Not needed for this pick, but recorded since it was checked and priced during the same research
pass: Fontshare's **Switzer**, **General Sans**, and **Cabinet Grotesk** (all Indian Type Foundry,
distributed via Fontshare) are free for commercial use under Fontshare's own license — verified via
search-engine-summarized results only (this stage's direct `WebFetch` of `fontshare.com/fonts/switzer`
returned an empty/JS-rendered shell, so treat this row as **less rigorously verified** than the
Geist pick above, not equally confirmed) and none of the three ship a matched tabular/mono cut in
the same release the way Geist and Söhne do, which is the specific mechanism D4/R4 ask for. Keep
Geist as the pick; only revisit this row if Geist itself becomes unavailable.

### 2.5 — Two more candidates the real Krater run surfaced (Section 0.1), checked and not adopted

`gpt-5.2-codex` independently proposed **IBM Plex Sans** (real, genuinely OFL-licensed, free) and
`claude-opus-5`'s reasoning trace independently proposed **Suisse Int'l** (Swiss Typefaces — real
foundry, but paid/custom-quote licensing, same "not price-verifiable today" problem as Söhne and
ABC Whyte above, and this stage did not separately re-verify its terms since the pattern was
already established twice). Neither changes the pick:

- **IBM Plex Sans** is a legitimate, free, real option — but it's IBM's own widely-adopted
  general-purpose system font, now common enough across developer tools and dashboards that it
  risks becoming exactly the "safe/versatile choice" D4 was written to route around, the same
  objection this whole initiative had to Inter/Space Grotesk in the first place. It's a reasonable
  fallback if Geist is ever rejected, but it doesn't clear D4's "distinctive" bar as cleanly as
  Geist does, and it doesn't ship a matched tabular/mono cut in the same release the way Geist Mono
  does.
- **Suisse Int'l** reinforces that the "distinctive licensed grotesque" direction D4 pointed at is a
  real, recognized category (this is now three independent sources — Stage 1's own research,
  gpt-5.2-codex, and opus-5 — converging on that same style family) — but it doesn't resolve the
  actual deferred question, which was cost. It's kept out for the same reason Söhne is: real, but
  not verifiable as "here's what it costs today" from this stage's tools.

Geist remains the pick: the only one of the five real candidates checked across both research
passes (Söhne, ABC Whyte, Geist, IBM Plex Sans, Suisse Int'l) with a cost that is both **free** and
**verified from a primary source** (the license file itself, not a model's memory or a
search-engine summary).

---

## 3. Requirement-by-requirement spec

Format per requirement: hierarchy, exact classes/markup, every state (default / hover /
focus-visible / loading / empty / error, each explicitly marked N/A with why when it doesn't
apply, per R1–R5's own discipline), mobile 375px vs desktop 1280px, interaction, copy, QA test.

Grid context confirmed from real call sites (`app/page.tsx:230`, `app/deals/DealFeed.tsx:1223`):
`grid grid-cols-1 gap-6 min-[680px]:grid-cols-2 min-[1024px]:grid-cols-3` — at 375px a card is
effectively full-bleed within its page gutter (single column); at 1280px it's one of three columns.
`DealCard`/`LockedDealCard` have **no internal breakpoint logic of their own** beyond
`PropertyPhoto`'s existing `h-28 sm:h-32` viewport height (640px breakpoint) — every other
difference between 375px and 1280px below is purely a consequence of the card's own width changing
inside its grid cell, not new responsive code. Stated explicitly per-requirement below rather than
assumed.

### 4.1 — R1: One evidence line, strict priority, footer removed

**Hierarchy:** hotel name (primary, unchanged) → meta line (secondary, unchanged) → at most one
evidence line (tertiary).

**Markup change:** `DealCard.tsx:169–185` currently renders up to 6 conditional cues in sequence
(the 7th, `DepositHoldCardSignal`, sits separately at line 238). Replace with a single resolver
that picks at most one, in this exact order, and renders it once in the current cue slot
(immediately after the meta `<p>` at line 163, before the price block):

```
disruption → pool/climate (pool wins on tie) → accessibility (if not expired) →
quiet-stay → review signal → EV charging (excluding unknown state) → funds/deposit hold
```

Implementation shape (exact JSX, replacing lines 164–188 and removing the standalone
`DepositHoldCardSignal` call at line 238):

```tsx
{winningCue ? (
  <p className={`mt-2 break-words text-caption font-medium leading-5 ${winningCue.warning ? 'text-[color:var(--warning)]' : 'text-[color:var(--text-2)]'}`}>
    {winningCue.copy}
  </p>
) : null}
```

where `winningCue` is computed once above the JSX return by evaluating the seven sources in
priority order and stopping at the first truthy one — `DepositHoldCardSignal`'s underlying
`getHotelFundsCardSignal(deal.fundsPolicy)` output must be normalized to the same
`{ copy, warning?, accessible }` shape the other six already return so it can slot into this one
resolver and this one render position (it currently renders via its own component at a different
position — that component usage is removed, its *copy function* is reused).

**Grid-row alignment (real finding from the Krater run, Section 0.1 — `claude-opus-5`'s reasoning
trace, adopted):** because the evidence line now renders *nothing* on some cards and one line on
others, and `DealCard` sits inside a 3-column grid at desktop
(`grid gap-6 min-[680px]:grid-cols-2 min-[1024px]:grid-cols-3`, confirmed real at `app/page.tsx:230`
and `app/deals/DealFeed.tsx:1223`), price blocks across the same row would visually mis-align by
however tall one evidence line is, whenever cards in that row disagree on whether they have one.
Fix: change `DealCard.tsx:151`'s content wrapper from `space-y-3` to `flex h-full flex-col`, and
add `mt-auto` to the price block's own class (`DealCard.tsx:190`, in addition to its existing
`space-y-2`) so the price block is pinned to the bottom of the column regardless of how much (or
how little) content renders above it. The evidence line's own text keeps `break-words`; add
`line-clamp-2` to it as well so one long evidence line can't push the price block down further than
a bounded two-line maximum on any card in a row.

**States:**
- *Default* — one line, or nothing, per the priority rule. No loading/error state exists (evidence
  is synchronous prop data — confirmed, not fetched).
- *Empty* — zero evidence sources present → render nothing. No placeholder text, ever.
- *Hover/focus* — N/A, static text, not interactive.
- *Mobile 375px* — `break-words` (already present) wraps long copy (e.g. disruption notices) to 2+
  lines inside a ~343px-wide card; this is existing, unchanged behavior.
- *Desktop 1280px* — same markup, more horizontal room (~380–400px card width in a 3-column grid),
  same single-line-usually rendering; no behavior difference beyond less frequent wrapping.

**Copy removed (exact, all conditions, delete `DealCard.tsx:259–263` entirely):** "Based on
{snapshotCount} price checks over 60 days · expaify never adds fees" — this content is not lost,
it becomes R5's tracking-indicator label (Section 5).

**QA:** fixture with disruption + quiet-stay + review present simultaneously → exactly the
disruption line renders. Fixture with only `fundsPolicy` present → exactly one line renders, in
the meta-adjacent slot, not after the price block. Fixture with zero sources → zero evidence lines,
and the old footer sentence never renders under any prop combination (grep the built output for
"expaify never adds fees" — must return zero matches anywhere in `DealCard`'s render).

### 4.2 — R2: Neutral price ink; `DealChip` + CTA are the only two chromatic elements

**Hierarchy in price block:** deal price (primary, `--ink`) → `/ night` + strikethrough median
(secondary, `--ink-faint`) → `DealChip` (tertiary, the block's only color) → "Price checked
{time}" (tertiary, `--ink-soft`).

**Exact class changes, `DealCard.tsx`:**

| Line | Current | New |
|---|---|---|
| 192 | `text-h2 leading-none text-[color:var(--primary)]` | `text-h2 leading-none text-[color:var(--ink)] text-tabular` |
| 196 | `text-small leading-none text-[color:var(--ink-faint)] line-through` | `text-small leading-none text-[color:var(--ink-faint)] line-through text-tabular` |
| 206–216 | "Price Verified" badge block | **removed entirely**, all conditions (confidence signal moves to R5) |
| 220–222 | `deal.headline` `<p>`, `text-[color:var(--primary)]` | **removed from `DealCard`'s render** — `deal.headline` stays a received prop (no prop removed, per the no-new/no-removed-required-prop constraint), simply not rendered here; deal-detail page is out of this stage's scope to wire up |
| 224–226 | `text-caption font-medium text-[color:var(--primary)]` | `text-caption font-medium text-[color:var(--ink-soft)] text-tabular` (on the "Save $X/night" text) |

`DealChip.tsx:9` — add `text-tabular` to the discount-percent span; color (`--gold`/`--gold-text`)
is unchanged, it is the card's one deliberate chromatic element in this block.

**Chromatic budget rule (exact, testable):** at most two non-neutral colors visible on a fully
populated card at once: `--gold` (`DealChip`) and `--primary` (the "View deal" CTA border/text,
`DealCard.tsx:242`, unchanged). Every other former `--primary` usage in this block is now `--ink`
or `--ink-soft`.

**States:**
- *Default* — colors as specified above.
- *Hover/focus* — no color change to the price block; card-level hover elevation
  (`group-hover:-translate-y-1 group-hover:shadow-[var(--shadow-card-hover)]`, article's existing
  class, unchanged) is unaffected by this requirement.
- *Loading/error* — N/A, price is always present when the card renders; no skeleton price state
  exists today and this requirement doesn't add one.
- *Empty* — `DealChip` already returns `null` when `discountPct <= 0` (unchanged,
  `DealChip.tsx:6`).
- *Mobile 375px* — `flex-wrap` on the price row (`DealCard.tsx:191`, unchanged) wraps
  price/median/chip onto a second line at narrow widths exactly as it does today; no new wrap
  behavior introduced by this requirement.
- *Desktop 1280px* — same row, less likely to wrap given more width; no behavior difference.

**Copy:** no strings change, only color (and the two removed elements above).

**QA:** render with every `showVerifiedBadge` condition true (`snapshotCount: 12, discountPct: 15,
updatedAt: <1h`) → confirm no "Price Verified" badge in the DOM under any prop combination.
Computed color of price/`.text-h2` resolves to `#141210` (`--ink`), never `#0E5A54` (`--primary`).
Exactly two distinct non-neutral computed colors present on a fully populated, non-expired card.

### 4.3 — R3: Photo runs edge-to-edge, `PropertyPhoto` chrome removed for `card` size, `Example` pill repositioned

**Two coordinated changes** (R2's original scope plus this stage's own finding from Section 1):

**(a) `DealCard.tsx:142–149`** — remove the `px-4 pt-3` wrapper. New structure:

```tsx
<div className="relative">
  <PropertyPhoto src={deal.photoUrl} size="card" loading={photoLoading} />
  {deal.isMock ? (
    <span className="absolute left-3 top-3 z-[2] inline-flex items-center rounded-[var(--radius-pill)] border border-[color:var(--line-white)] bg-[color:var(--surface)] px-2 py-1 font-display text-caption font-bold leading-none text-[color:var(--ink-soft)] shadow-[var(--shadow-card-rest)]">
    Example
  </span>
  ) : null}
</div>
```

The `relative` wrapper carries **zero padding/margin** — it exists only as a positioning anchor for
the absolutely-positioned pill, which satisfies D3's "no padding wrapper" (the constraint is about
inset spacing pushing the photo inward, not about the literal absence of any wrapper element). The
pill moves from static (above the photo, inside the old padded div) to an overlay (top-left, on top
of the now edge-to-edge photo) — this is the exact markup consequence R2 flagged as real but did
not specify; specified here. `bg-[color:var(--surface)]` (opaque white) plus a `--line-white`
border and the card's own resting shadow token keep the pill legible over photos of any brightness,
including light-colored ones, without inventing a new color.

**(b) `PropertyPhoto.tsx`, `card` size only** (new finding, Section 1) — the `card`-size figure
currently carries a border, the wrong radius (12px vs. the article's 16px), and an unconditional
"Property photo" `<figcaption>` bar. None of D3/R3's edge-to-edge/no-chrome intent survives if this
is left as-is. Scoped exactly to `size === 'card'` (confirmed the only other consumers,
`size="expanded"`/`"detail"`/`"thumbnail"`, are untouched by this change):

- `sizeClasses.card.container` (`PropertyPhoto.tsx:14`): change
  `'w-full rounded-[var(--radius-control)]'` → `'w-full rounded-[var(--radius-card)]'` (matches
  the parent article's 16px radius exactly, so the now-flush edges read as one continuous curve,
  not a nested double-radius notch).
- The `<figure>` element (line 75): for `size === 'card'`, drop `border border-[color:var(--border)]`
  from its className (keep it for the other three sizes, which are unaffected by this directive
  and still benefit from that chrome in their own contexts — detail/expanded/thumbnail views).
- The `<figcaption>` block (lines 95–97): for `size === 'card'`, do not render it at all. (For
  the other three sizes, keep it — this directive is scoped to `DealCard`/`LockedDealCard`'s hero
  photo specifically, not every photo in the app.)
- The "missing photo" fallback (lines 62–70, `!src || failed` branch) similarly drops its
  `border border-[color:var(--border)]` for `size === 'card'` only, so a missing-photo card is
  equally edge-to-edge, not bordered while a loaded one isn't.

**States:**
- *Default* — edge-to-edge image, `--radius-card` clipping, no border, no caption bar.
- *Loading* — unchanged: `photoLoading` prop continues to control `<img loading>` exactly as
  today; the `skeleton` overlay (`PropertyPhoto.tsx:79`) is untouched by this change.
- *Empty* (`photoUrl` undefined) — the "Photo unavailable" fallback now also runs edge-to-edge
  (border dropped per above), not inset.
- *Hover/focus* — unchanged; no hover treatment added to the photo itself (out of scope, would be
  a net-new interaction not grounded in D1–D5 or R1–R5).
- *Mobile 375px* — photo width = card width exactly (no gutter on the sides now that the wrapper's
  padding is gone); viewport height stays `h-28` per `PropertyPhoto`'s existing breakpoint (unchanged
  by this requirement, that breakpoint is `sm:` = 640px, unrelated to this component's own width).
- *Desktop 1280px* — same edge-to-edge behavior at the wider ~380–400px card width; viewport height
  becomes `h-32` per the existing `sm:h-32` rule (unchanged, just now visibly wider too since there's
  no more `px-4` eating 32px off each side).

**Interaction:** none — photo isn't independently clickable; whole-card overlay link
(`DealCard.tsx:273–278`) unaffected.

**Copy:** "Example" pill text unchanged. "Property photo" figcaption text is removed (for `card`
size only) — this is a copy removal, not a copy change, and it's load-bearing: that caption was
never part of any D1–D5/R1–R5 directive's visible-copy list, it was a `PropertyPhoto`-internal
label this stage's own re-verification found.

**Implementation/QA note (real finding from the Krater run, Section 0.1 — `claude-opus-5`'s
reasoning trace):** once the photo is flush against the article's own `overflow-hidden` +
`rounded-[var(--radius-card)]` edge with no padding between them, verify specifically in Safari —
nested `overflow-hidden` containers sharing an identical border-radius at a zero-offset edge are a
known source of a hairline sub-pixel clipping seam in WebKit. If this appears during implementation,
the fix is a 1px‑smaller radius on the inner image only
(`rounded-t-[calc(var(--radius-card)-1px)]`), not a change to the article's own radius token. Not
applied pre-emptively here since it may not reproduce with this exact structure — recorded as a
specific thing to check, not a required class.

**QA:** DOM inspection — `PropertyPhoto`'s root `<figure>` is the article's first child (no
intervening `<div className="px-4...">`); rendered image bounding box touches the article's
left/right edges at 375px and 1280px; zero `<figcaption>` elements exist inside a `DealCard` or
`LockedDealCard` instance; the `Example` pill (mock fixture) renders as an `absolute` element with
computed `top`/`left` near the photo's top-left corner, not in normal document flow above the
photo. Visually verify no hairline seam at the photo's top corners in Safari specifically (see
implementation note above).

### 4.4 — R4: Typography — see Section 2 in full (font pick, setup, tabular rule). No additional
states beyond what's specified there; typography doesn't vary by interaction state.

### 4.5 — R5: Visible tracking indicator (`DealCard`) + redaction-not-blur (`LockedDealCard`)

**Part A — `DealCard` tracking indicator**, replacing the deleted footer line, rendered in the
same `space-y-3` content column, directly after the price block (`DealCard.tsx:236`, where the
now-removed `DepositHoldCardSignal` and footer paragraph used to sit):

```tsx
{showTrackingIndicator ? (
  <div className="space-y-1" style={{ opacity: deal.snapshotCount >= 12 ? 1 : 0.6 }}>
    <div
      role="img"
      aria-label={`${formatMoney(deal.dealPrice)} is ${deal.discountPct}% below the 60-day median of ${formatMoney(deal.medianPrice)}, based on ${deal.snapshotCount} price checks.`}
      className="h-1.5 w-full overflow-hidden rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]"
    >
      <div
        className="h-full rounded-[var(--radius-pill)] bg-[color:var(--primary)]"
        style={{ width: `${Math.min(100, (deal.dealPrice.priceCents / deal.medianPrice.priceCents) * 100)}%` }}
      />
    </div>
    <p className="text-caption leading-snug text-[color:var(--ink-faint)] text-tabular">
      Tracked 60 days · {deal.snapshotCount} checks
    </p>
  </div>
) : null}
```

- **`showTrackingIndicator`** = `!deal.isMock && !deal.expired` (matches the existing pattern the
  removed footer line used, `DealCard.tsx:259` — same two conditions, same reasoning: mock and
  expired cards don't carry a live tracking claim).
- **Fill math (exact, verified against `Money.priceCents`, never a float or formatted string):**
  `(deal.dealPrice.priceCents / deal.medianPrice.priceCents) * 100`, clamped to `[0, 100]` as a
  defensive ceiling even though `DEAL_THRESHOLD = 0.70` in `lib/pipeline/dealRules.ts`
  mathematically bounds every flagged deal's fill to ≤70% — the clamp exists so the bar never
  visually overflows if this component is ever reused somewhere the 0.70 gate hasn't run yet,
  without asserting anything false in the normal case.
- **Defensive guard (real finding from the Krater run, Section 0.1 — `gpt-5.2-codex`, adopted):**
  do not render the indicator at all if `deal.medianPrice.priceCents <= 0` — this avoids a
  division-by-zero producing `NaN%`/`Infinity%` width if malformed or legacy data ever reaches this
  component. This is a defensive check only; it doesn't change `showTrackingIndicator`'s two real
  conditions above, it's an additional guard on top of them.
- **Opacity confidence tier:** `1` at `snapshotCount >= 12`, `0.6` for 8–11 (the same threshold
  `showVerifiedBadge` used before R2 removed it, `DealCard.tsx:125–130`). This state cannot go
  lower — `evaluateDeal()` in `lib/pipeline/dealRules.ts` already forces `action: 'expire'` below
  `MIN_SNAPSHOTS = 8`, so a flagged, non-expired `DealCard` can never render with `snapshotCount < 8`.
  Documented here explicitly rather than adding dead code for an unreachable state.
- **Track color:** `--line-ivory` (a neutral, matches the existing "quiet structural" token used
  elsewhere for muted backgrounds, e.g. `--bg-muted`). **Fill color:** `--primary` — this is a
  deliberate, single **exception** to R2's two-color chromatic budget (`--gold` + `--primary` CTA):
  `--primary` here is not a third distinct hue, it's the *same* teal already budgeted for the CTA,
  reused for a second, non-competing purpose (a factual progress indicator, not a persuasive
  accent) — R2's "at most two chromatic elements" rule is about distinct hues, and this doesn't add
  one.

**States:**
- *Default* — bar + label as specified.
- *Below `MIN_SNAPSHOTS`* — cannot occur in production (see above); documented, not built.
- *Mock data* (`deal.isMock`) — does not render (`showTrackingIndicator` is false).
- *Expired* — does not render (matches the existing grayscale-card pattern that already suppressed
  the old footer line).
- *Hover/focus* — N/A, `role="img"`, non-interactive, static.
- *Loading/error* — N/A, same synchronous-prop-data reasoning as R1.
- *Mobile 375px* — bar is `w-full` (percentage-based, not a fixed pixel track), so it scales
  correctly at any card width without a separate mobile rule — this is a direct, deliberate
  consequence of not hardcoding a pixel track width.
- *Desktop 1280px* — same bar, wider track in absolute pixels, identical percentage fill; no
  different behavior needed.

**Label copy (exact, tabular per R4):** `"Tracked 60 days · {snapshotCount} checks"` — e.g.
"Tracked 60 days · 14 checks."

**Accessibility (exact aria-label, fully derived from existing props, no fabrication):**
`"{dealPrice formatted} is {discountPct}% below the 60-day median of {medianPrice formatted}, based
on {snapshotCount} price checks."`

**Part B — `LockedDealCard`: remove full-card blur, redact only name + price**

**Exact class removals, `LockedDealCard.tsx`:**

| Line | Current | New |
|---|---|---|
| 57 | `select-none px-4 pt-3 blur-[6px] transition-all duration-300 group-hover:blur-[4px]` | `px-4 pt-3` (photo un-blurred; padding is unchanged here — R3's edge-to-edge directive is scoped to `DealCard` only, per D3's explicit component naming; `LockedDealCard`'s photo stays inset) |
| 69 | `pointer-events-none select-none blur-[5px]` (wraps name + meta) | split into two: name stays redacted (see below), meta (`stars`/`city`) becomes plain, un-blurred text with no special wrapper needed |
| 75 | `pointer-events-none select-none space-y-0.5 blur-[5px]` (wraps the 3 placeholder price bars) | `space-y-0.5` only (blur removed; bars themselves already are placeholder blocks, not real data, so they stay as-is visually, just sharp instead of blurred) |
| 87 | `pointer-events-none select-none blur-[5px]` (wraps the 4 OTA-name chips) | removed entirely — chips become plain, sharp, un-blurred text (this content — "Expedia," "Booking," "Kiwi," "Trip.com" — was never sensitive; only the redaction target is name + price per D5) |

**Redacted elements (fixed-width placeholder blocks, replacing what today are blurred real
elements at lines 70–74 for the name and the three bars at 77–79 for price):**

```tsx
<div className="space-y-1" aria-hidden="true">
  <div className="h-5 w-3/5 rounded-[6px] bg-[color:var(--line-ivory)]" />
  <p className="text-caption mt-0.5 leading-snug text-[color:var(--ink-faint)]">
    {stars === null ? 'Not yet rated' : starChars(stars)} · {placeholderCity}
  </p>
</div>
<div className="h-8 w-28 rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]" aria-hidden="true" />
```

- Hotel-name line → one `h-5 w-3/5 rounded-[6px] bg-[color:var(--line-ivory)]` block,
  `aria-hidden="true"`.
- Star rating + city → **not** redacted (both already non-sensitive per D5 and the un-blur
  directive); rendered as plain visible text, same copy as today (`starChars(stars)` /
  "Not yet rated" · `placeholderCity`).
- Deal-price row → **one** `h-8 w-28 rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]`
  block, `aria-hidden="true"` — collapsing the current three separate bars (77–79) into one,
  because (per R2's `deepseek-v4-pro` finding, re-confirmed against the real
  `LockedDealCardProps` type this stage re-read) no call site passes a real `dealPrice` into this
  component at all, only `placeholderName`/no price field — three differently-sized bars implied a
  breakdown (price / "/ night" / strikethrough median) that was never backed by real data even
  before this change; one block is the honest version.
- Top-right "Save X%" pill (`LockedDealCard.tsx:43–46`) — **unchanged**, already unblurred, already
  using real `discountPct`.

**States:**
- *Default* — no blur anywhere on the card. City/stars/photo/discount/OTA-chip-labels crisp;
  name/price redacted as fixed blocks.
- *Hover* — existing `border-[color:var(--gold-deep)]` + `shadow-card-hover` +
  `-translate-y-1` treatment (`LockedDealCard.tsx:41`) unchanged. Redaction blocks do not animate
  on hover — no shimmer, no pulse (static, matching R2's deliberate rejection of decorative
  flourish).
- *Focus (keyboard)* — existing `focus-visible:ring-2 focus-visible:ring-[color:var(--gold-deep)]`
  (line 41) unchanged.
- *`accessibilityNeedsSelected`* — existing conditional caption (line 82–85) unchanged, already
  un-blurred.
- *Mobile 375px* — redaction blocks are relative-width (`w-3/5`, `w-28` in fixed px for the price
  pill since it mimics a real currency-pill's natural width) — `w-3/5` on the name scales with card
  width; the `w-28` price block (112px) is a deliberate fixed width matching the real price
  block's typical rendered width at any card size, not a responsive value, since price strings
  don't meaningfully vary in width by breakpoint.
- *Desktop 1280px* — same blocks, more surrounding whitespace; no different behavior.

**Copy — aria-label on the outer `<a>` (`LockedDealCard.tsx:40`):** unchanged character-for-character
— it never referenced blur, name, or price, so it remains accurate without edits, confirmed by
re-reading it directly this stage.

**Interaction:** unchanged — one `<a>` to `trackingHref(joinHref, discountPct)`, `onClick` fires
the existing `track('click_card_teaser_unlock', ...)` call, both untouched.

**QA:** render with fixture props → zero elements have any `blur-*` class; city text and star
glyphs are legible (not `aria-hidden`, not `pointer-events-none`); exactly two `aria-hidden="true"`
placeholder blocks exist (name, price); OTA chip labels ("Expedia" etc.) are legible plain text;
aria-label on the outer `<a>` is byte-identical to today's value.

---

## 4. Constraints re-confirmed

- **No new required prop** on `DealCard` or `LockedDealCardProps` — every change above uses fields
  already on the real types re-read this stage (`DealCardDeal`: `id, hotelName, city, stars,
  photoUrl, dealPrice, medianPrice, discountPct, checkInWindow, snapshotCount, links, headline,
  isMock, firstSeen, updatedAt, expired, reviewEvidence, fundsPolicy`; `LockedDealCardProps`:
  `placeholderName, placeholderCity, stars, discountPct, photoUrl, joinHref,
  accessibilityNeedsSelected`). `PropertyPhoto`'s prop surface (`src, size, loading, onFailure`) is
  also unchanged — the `card`-size chrome change is internal to how that existing size variant
  renders, not a new prop.
- **Money stays `{ priceCents: number; currency: string }`** throughout — R5's fill-percentage math
  operates on `.priceCents` directly, never a formatted or floated value; `formatMoney()` is used
  only for display strings (the price span text, the aria-label), never for the underlying
  computation.
- **No fabricated stats** — the tracking bar's ≤70% real-world bound is a direct consequence of
  `DEAL_THRESHOLD = 0.70` (`lib/pipeline/dealRules.ts`), not an invented scale; the confidence-tier
  opacity reuses `showVerifiedBadge`'s exact prior threshold rather than inventing a new one; the
  Geist typeface's $0 cost is a directly fetched, quoted license file, not a memory claim.
- **Reused existing design tokens throughout** — no new hex value, radius, or shadow was invented
  anywhere in this spec; the only genuinely new CSS is the `.text-tabular` utility (a
  `font-variant-numeric` rule, not a color/spacing token) and the `--font-mono` custom property
  (needed because it didn't exist before Geist Mono was introduced).
- This stage produced a document only — no file under `app/`, `lib/`, or `components/` was
  modified, and nothing was committed.

---

## Handoff

Per this run's explicit instruction, this stage does not create the next-stage ticket. The natural
next stage per `AGENTS.md`'s pipeline is `UI-PREMIUM-REDESIGN-01`, which should implement exactly
the markup/class/CSS changes specified in Sections 2–3 above across `app/layout.tsx`,
`app/globals.css`, `app/components/ui/DealCard.tsx`, `app/components/ui/LockedDealCard.tsx`,
`app/components/ui/DealChip.tsx`, and `app/components/ui/PropertyPhoto.tsx` (the `card`-size path
only), then run `npx tsc --noEmit --incremental false` and verify against every QA check listed
per-requirement above before handing off to TEST.
