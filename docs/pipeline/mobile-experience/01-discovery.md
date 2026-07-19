# UX Discovery — Mobile Experience Audit (375px)

**Ticket:** UXD-MOBILE-EXPERIENCE-001
**Stage:** UXD (Discovery)
**Date:** 2026-07-19
**Method:** Static code audit of every page component and shared UI primitive under `app/`, breakpoint census (`grep` for `sm:|md:|lg:|min-[…]`), tap-target math from Tailwind classes, and iOS-specific input behavior checks. No live viewport render was performed; all measurements are derived from the class values in source.

---

## Problem statement

Core revenue surfaces — the deal feed, deal detail page, and onboarding — were built desktop-first, so at 375px the filter popover clips off-screen, the card-level booking links and most preference controls fall well under the 44px tap-target minimum, every text input triggers iOS auto-zoom on focus, and the primary CTA on both deal detail and onboarding step 1 sits one to three screens below the fold with no sticky affordance.

## Who is affected, and where

Mobile visitors (a significant share of hotel-deal browsing, per the ticket) hit these problems at the exact steps that create and convert intent:

1. **Browsing** (`/deals` — DealFeed + DealCard): the first surface every member sees daily.
2. **Deciding/booking** (`/deals/[dealId]` — deal detail): the page whose only job is getting the user to an OTA deeplink.
3. **Activating** (`/onboarding` step 1): the first thing a new member does after paying/starting a trial.
4. **Managing** (`/account`): secondary, degraded but functional (documented as an honorable mention, not top 3).

## Breakpoint census (measurable signal #1)

Files with **zero** responsive breakpoints despite being primary mobile surfaces:

| Surface | File | Breakpoints |
|---|---|---|
| Deal feed page shell | `app/deals/page.tsx` | none |
| Deal feed logic + filters | `app/deals/DealFeed.tsx` | only `min-[680px]`/`min-[1024px]` grid cols; popover right-anchoring only ≥680px |
| Deal card | `app/components/ui/DealCard.tsx` | none |
| Deal detail | `app/deals/[dealId]/page.tsx` | only hero height + facts grid |
| Account dashboard | `app/account/page.tsx`, `app/account/AccountClient.tsx` | none |
| NL search bar | `app/components/ui/SearchBar.tsx` | none |

By contrast `app/book/BookingFlow.tsx` (43 responsive classes) and `FlightCard`/`HotelCard` were mobile-audited previously — the gap is concentrated in the newer hotel-deals membership surfaces.

## Top 3 flows that break or degrade most at 375px

### Flow 1 — Deal feed browsing (`/deals`) — BREAKS

**F1.1 Filter popover clips off the right viewport edge.**
`app/deals/DealFeed.tsx:172` — the popover is `absolute left-0 … min-w-[176px]`, and only switches to right-anchored (`min-[680px]:right-0`) at ≥680px. At 375px the four filter pills wrap onto 2–3 rows; any pill whose left edge sits past ~199px (375 − 176) opens a menu that overflows the viewport, clipping option text and forcing horizontal scroll. The Destination menu (21 items) is the widest and most likely to clip.
*Repro:* 375px viewport, premium session, tap "Stars" or "Max price" after wrap.

**F1.2 Card-level OTA booking links are ~30px tall.**
`app/components/ui/CompareRow.tsx:26` — compact size is `py-2 text-[11px] leading-none` ≈ 11px text + 16px padding ≈ **29–31px** tap height, half the 44px minimum. These are the card's only outbound conversion links, rendered 2-across at 375px (`min-[420px]:grid-cols-4` never fires at 375px). Mis-taps land on the card link → unintended navigation to the detail page instead of the OTA.

**F1.3 iOS auto-zoom on the search input.**
`app/components/ui/SearchBar.tsx:96` — input is `text-[14px]`. iOS Safari zooms the page on focus for any input under 16px (the root `viewport` export in `app/layout.tsx` correctly does not clamp `maximum-scale`, so zoom fires). The user focuses search, the page jumps to ~114% zoom, and stays zoomed after dismissing the keyboard. Same defect class exists in `.field-input` (`app/globals.css`, `font-size: 15px`) used by the join form.

**F1.4 Filter chrome consumes the first viewport.**
Header + 4 wrapped filter pills + tab bar + search bar + sort control + premium-lock line stack to roughly a full 667px viewport before the first deal card. No mobile pattern (horizontally scrollable pill row, or a single "Filters" button opening a sheet) exists. Popover option rows (`DealFeed.tsx:185`, `py-2 text-[13px]` ≈ 37px) and the SearchBar "Clear" (bare 13px text button, `SearchBar.tsx:117-124`) are also sub-44px.

### Flow 2 — Deal detail (`/deals/[dealId]`) — DEGRADES at the conversion step

**F2.1 No sticky booking CTA.**
`app/deals/[dealId]/page.tsx:333-339` — the primary action zone (`CompareRow size="primary"`) renders once, mid-page, directly after the price. Below it stream four more sections (price history, deal score, "Why this is a deal", "Stay details") totalling roughly 2–3 additional 375px screens. A user who reads to the bottom — the natural behavior on a page arguing "why this is a deal" — has no booking affordance in view and must scroll back up. The ticket explicitly flags sticky CTAs; this is the highest-value miss.

**F2.2 The page has no mobile-specific layout states at all** beyond hero height (`min-[680px]:h-[320px]`) and the facts grid. It survives 375px because it is single-column by construction, but the title row (`page.tsx:285`) places `ShareButton` beside a 30px-display-font `h2`; a long hotel name wraps 3–4 lines at ~287px of text width and pushes the price toward the fold.

**F2.3 Locked-deal variant back link** (`page.tsx:66`) lacks the `min-h-[44px]` its unlocked sibling has (`page.tsx:239`) — inconsistent tap target on the paywall page free users see most.

### Flow 3 — Onboarding step 1 (`/onboarding`) — DEGRADES at activation

**F3.1 The Continue CTA is ~3 screens below the fold.**
`app/onboarding/OnboardingClient.tsx:111-140,170-187` — step 1 renders all 20 destination cards in `grid-cols-2` at 375px (card ≈ 161×121px → 10 rows ≈ 1,300px + header ≈ 1,700px total) with the Back/Continue footer *after* the grid, not sticky. A new member's first paid-experience screen requires a blind full-page scroll to find the only forward action. The step progress bar also scrolls away, so there is no persistent orientation or CTA.

**F3.2 Invisible-but-present Back button.** `OnboardingClient.tsx:175` uses `disabled:opacity-0` on step 0 — a full-size invisible button that still occupies layout space and remains in the accessibility tree (announced as a disabled "Back" button to screen readers on a step where it does nothing).

### Honorable mention — Account dashboard (`/account`)

Functional at 375px but systematically sub-44px: watchlist city pills ≈ 33px (`AccountClient.tsx:141`), frequency/threshold pills ≈ 37px (`AccountClient.tsx:93,114`), the welcome-banner dismiss is a bare 18px "×" link (`app/account/page.tsx:58`), and "Sign out" is a bare 13–14px text button. Should ride along with the tap-target fix wave rather than anchor its own pipeline run.

## Constraints the solution must respect

1. **Design system only** — reuse existing tokens (`--radius-pill`, `--primary`, `.btn` already enforces `min-height: 44px`) and type scale in `app/globals.css`; no new colors or font sizes. Fixing inputs to 16px must go through the shared `.field-input`/input classes, not per-component overrides.
2. **Paywall and contract integrity** — filter pills, search, and sort carry premium gating (`disabled={!premium}`) and OTA links carry affiliate markers via `lib/paywall` / provider layer; mobile restructuring (sheets, sticky bars) must not bypass locked states or alter deeplink generation.
3. **Accessibility over cleverness** — do not clamp `maximum-scale` in the viewport export to suppress iOS zoom (that breaks pinch-zoom for low-vision users); fix input font size instead. Sticky CTAs must not trap focus or cover the last content block, and popover/sheet patterns must keep the existing Escape/outside-tap dismissal and `aria-` wiring already present in `FilterPill`.

## Success statement

This is solved when a first-time mobile user on a 375px viewport can (a) open any filter and read every option without horizontal clipping, (b) tap an OTA link on a card or the detail page on the first try without hitting an adjacent target, (c) focus search without the page zooming, and (d) always see a Continue/booking CTA on onboarding step 1 and the deal detail page without scrolling back — with no regression to desktop 1280px, paywall gating, or affiliate deeplinks.

## Recommended UXR scope (top 3, in order)

1. Deal feed filters + card tap targets (F1.1–F1.4)
2. Deal detail sticky CTA (F2.1–F2.3)
3. Onboarding step-1 sticky footer (F3.1–F3.2)

Account tap targets (honorable mention) can be folded into whichever design directive standardizes the 44px pill.
