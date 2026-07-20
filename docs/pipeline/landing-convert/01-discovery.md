# UXD-LANDING-CONVERT-001: Landing Page Conversion and Trust

**Stage:** UX Discovery
**Date:** 2026-07-19
**Surface:** `app/page.tsx` (anonymous landing page) + `app/components/LandingNav.tsx`, `app/components/FaqAccordion.tsx`, `app/components/ui/DealCard.tsx`, `app/components/ui/LockedDealCard.tsx`, `app/components/ui/CompareRow.tsx`
**Note:** The prior `docs/pipeline/homepage-copy-density/` docs describe a search-form homepage that no longer exists. The current landing is a hotel-deal-tracker marketing page. This discovery supersedes that context.

---

## Problem Statement (one sentence)

A skeptical first-time visitor to the expaify landing page is asked to trust the product on the basis of evidence that is fabricated, inconsistent, or broken — a hardcoded "2,400+ deal hunters" claim, demo deals dressed up with always-fresh "found 3h ago" timestamps and dead outbound links, and three different deal-threshold numbers on the same page — so the one visitor segment the page must convert (skeptics who check the details) is the segment most likely to bounce.

## Who Is Affected, and Where

- **Who:** Anonymous first-time visitors with deal-hunting intent — people who already use Booking/Expedia and are being asked to add a $8–12/month membership layer on top. By definition this audience is price-sensitive and skeptical of "too good to be true" claims.
- **Where in the flow:** The very first step — landing page, before any signup. Secondary exposure on the `/join` CTA path (nav, hero, pricing cards) and the `/deals` teaser path.
- **When it bites hardest:** When the deals table is empty or the DB is unreachable, `getActiveDeals` falls back silently (`.catch(() => [])`, `app/page.tsx:91-100`) and the entire page's "evidence" becomes mock data. This is the worst case and also the likely state for a new deployment — exactly when first-time visitors arrive.

## What a Skeptical Visitor Sees in the First 5 Seconds

**Desktop (1280px):** Nav ("Join the club"), headline "Never overpay for a hotel again.", subhead naming four OTAs and a "30%+" promise, two CTAs, a 5-star "Trusted by 2,400+ deal hunters" line, and a rotated deal-card stack showing a Lisbon hotel at 54% off, "found 3h ago".

**Mobile (375px):** Nav + headline + subhead + CTAs + the star/trust line fill the first viewport. The deal card — the only concrete product evidence — sits **below the fold**. The first scroll shows the fabricated proof (star line) but not the real proof (the card).

The 5-second impression is coherent ("they watch hotel prices and tell me when they drop") — the headline itself is not the problem. The problem is that every supporting proof point collapses under one skeptical tap or a second read.

## Measurable Signals That the Problem Exists (verified in code)

1. **Fabricated social proof.** "Trusted by 2,400+ deal hunters" with five gold stars is a hardcoded string (`app/page.tsx:129-132`). No user count, review source, or rating exists anywhere in the codebase. This is the page's *only* social proof, and it is invented. It is also a legal/brand liability (unsubstantiated claim).
2. **Deceptive freshness on demo deals.** `MOCK_HERO.firstSeen` is computed as `Date.now() - 3h` on every request (`app/page.tsx:56,71`), so the demo card *always* says "found 3h ago" — manufactured recency. The only disclosure is a faint 12px "Preview deal" caption at the card bottom (`DealCard.tsx:159-161`). The mock teaser section is headed "Caught this week" (`app/page.tsx:177`) even when nothing was caught.
3. **Dead links on the first interactive element.** Mock deals set OTA links to `'#'` (`app/page.tsx:68,84`), which `CompareRow` renders as real anchors (`target="_blank" rel="sponsored"`). A visitor who clicks "Expedia" on the hero card — the most inviting element on the page — gets a new tab of the same landing page. Dead-click on first interaction.
4. **Stale demo dates.** `MOCK_HERO.checkInWindow` is "Mar 12 – 14" (`app/page.tsx:66`). Today is July 2026: a check-in window four months in the past sits directly next to "found 3h ago". A skeptic reads this as either a dead product or a fake card. (Both mock windows are static strings and will always eventually go stale.)
5. **Three conflicting deal definitions on one page.** Hero and metadata promise "drops 30%+ below normal"; How-it-works says "30% below its rolling median — with at least 3 days of price history"; the FAQ says "70% or below its median — with at least **8** historical data points" (`FaqAccordion.tsx:13`). Code truth: `DEAL_THRESHOLD = 0.70`, `MIN_SNAPSHOTS = 3` (`lib/pipeline/dealRules.ts:9-11`). The FAQ's "8" matches nothing. Worse, the landing feed itself queries `minDiscount: 20` (`app/page.tsx:95`), so real deals at 20–29% off can render directly beneath a "30%+" promise.
6. **Same deal shown twice.** `heroCard` renders in both the hero and the dark band (`app/page.tsx:150,264`). With ≤1 real deal, a visitor scrolling the page sees the identical hotel card twice — reads as thin inventory.
7. **CTA copy is inconsistent across one page.** "Join the club" (nav), "Join for free" (hero), "Get started free" (free plan), "Start free trial" (premium), "Unlock with Premium" (locked cards). No "club" exists anywhere else in the product. A first-time visitor cannot tell whether the primary action is a free signup, a trial, or a purchase.
8. **Value-prop specificity is buried.** The concrete scope claims — 20 tracked markets (with the city list), daily snapshots, 60-day medians, "we never handle your payment" — live in the FAQ accordion and metadata description, invisible until the sixth section. The hero subhead spends its specificity budget naming four OTAs instead of answering "which destinations?" and "how do you know what's normal?", the two questions a skeptic asks first.
9. **Screen-reader gap on the proof element.** In `DealCard.tsx:123-124` the star row has both `aria-label` and `aria-hidden` on the same span — `aria-hidden` wins, so star ratings are not exposed to assistive tech at all.

**Instrumentable signals:** landing bounce rate; `/join` click-through from hero vs. pricing; dead-click rate on mock CompareRow anchors; scroll depth past the logo strip at 375px.

## What's Missing vs. Skyscanner, Hopper, Scott's Cheap Flights (Going)

At the interaction-pattern level (not visual style):

- **Going (Scott's Cheap Flights):** leads with *verifiable, specific* wins — named deals with real before/after prices and dates, attributed member testimonials, aggregate stats it can substantiate ("members saved $X on average"). expaify's equivalent slots are filled by invented numbers.
- **Hopper:** earns trust through *data provenance* — "we analyze N prices daily" tied to visible predictions, plus app-store ratings it actually has. expaify has a genuinely equivalent asset (daily snapshots, 60-day medians, "43 price checks" trust line on cards) but undercuts it by attaching those provenance lines to fabricated deals.
- **Skyscanner:** free and gateless — trust via zero commitment. expaify gates with a membership, which *raises* the proof burden; its page currently carries less verifiable proof than the free competitor while asking for more commitment.

The pattern gap in one line: **competitors show attributable evidence; expaify shows invented evidence.** expaify's honest assets — real snapshot counts, a real methodology, a real city list, "you book on the OTA, we never touch payment" — are stronger than what the page currently fakes, and they are all hidden or contradicted.

## Constraints the Solution Must Respect

1. **Data integrity / honesty:** No invented user counts, ratings, or testimonials. Any demo/preview deal must be unmistakably labeled as a demo at first glance (not a 12px footnote), must not carry manufactured freshness timestamps, and must not render dead outbound links styled as bookable. All threshold copy (30%, snapshot minimums) must match `lib/pipeline/dealRules.ts` from a single source of truth.
2. **Brand & performance:** Use existing design tokens in `app/globals.css` (`--ink`, `--primary`, `--gold`, `--surface`, `--radius-card`, etc.) and existing components (`DealCard`, `LockedDealCard`, `CompareRow`). The page is a server component with one DB query; no new client-side data fetching, no new external calls, no layout-shifting embeds.
3. **Accessibility & mobile:** Usable at 375px and 1280px; the first mobile viewport must contain at least one piece of genuine product evidence, not only claims. Interactive elements keep focus states and correct aria exposure (fix the star-row `aria-hidden`/`aria-label` conflict when that card is touched).

## Success Statement

This is solved when a skeptical first-time visitor can land on the page, understand within the first viewport what expaify tracks (hotels, 20 named markets, daily, 60-day baselines) and what triggers an alert (≥30% below median), see at least one deal whose evidence is either real or explicitly labeled as a demo — with no invented user counts, no manufactured timestamps, no dead outbound links, and no number that contradicts another section — and click one consistently-worded free-signup CTA without hitting a claim they can falsify.

## Handoff Notes for UXR

- Audit the empty-DB render path specifically (`realDeals.length === 0`) — that is the state a new visitor most likely sees; every fabrication above activates in it.
- Benchmark Going's deal-preview pattern (how they show example deals honestly to logged-out users) and Hopper's data-provenance framing. The question for research: *how do reference products present proof when they can't yet show the user personalized inventory?*
- Decide the fate of the star-rating trust line: replace with substantiable stats (snapshot counts, markets tracked, median history depth — all real and already in the DB) vs. remove entirely.
- The pricing section and FAQ copy are in scope only where they contradict the deal rules; pricing structure itself is not.
