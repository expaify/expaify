# UX Design Specification: Locked Deals Optimization (UX-AUDIT-PREMIUM-FILTER-DEALS-ORG-01)

This specification addresses the clutter and banner-blindness caused by 12 identical `<a href="/join">Unlock with Premium</a>` buttons rendering simultaneously on a single search results page. 

By taking advantage of the backend sorting order (which groups locked deals at the end of the grid) and using real `discountPct` data, we replace redundant, low-context noise with a high-contrast, data-driven system: a single **Sticky Hub Control Bar** and high-utility **Teaser Affordances** on individual locked cards.

---

## 1. State Matrix & Layout Engine Behavior

The locked deals module transitions dynamically based on the active state of the API query and search filters.

```
┌──────────────────────────────────────────────────────────┐
│                      Search Results                      │
├──────────────────────────────────────────────────────────┤
│  [Active Deal Card]  [Active Deal Card]  [Active Card]   │
├──────────────────────────────────────────────────────────┤
│  [Locked: 62% Off]   [Locked: 55% Off]   [Locked: 48%]   │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│   ★  Unlock 12 premium deals found today.  [Unlock All]  │  ◄ Sticky Hub Bar (Slides in)
└──────────────────────────────────────────────────────────┘
```

### A. Default State (Locked Group Rendered)
*   **Trigger**: The page returns $N$ locked deals ($N \ge 1$), positioned after active unlocked deals.
*   **Behavior**:
    *   Each locked card renders an unblurred, razor-sharp discount badge showcasing its real API `discountPct`.
    *   Individual heavy overlay buttons are removed.
    *   A single, viewport-sticky **Premium Hub Control Bar** anchors to the bottom of the window once the user scrolls to or past the first locked card.

### B. Loading State
*   **Trigger**: Filter transition, active query refresh, or initial pagination state.
*   **Behavior**:
    *   The Sticky Hub Bar is hidden (`opacity-0 pointer-events-none`).
    *   Locked cards render in a skeleton state with a shimmering, pulse animation overlay on the unblurred discount area, maintaining the structural layout integrity.

### C. Zero-Deals State (Empty)
*   **Trigger**: Search results return zero locked deals (e.g., all returned properties are unlocked, or no properties match the query filters).
*   **Behavior**:
    *   **Do not render** the Sticky Hub Bar under any circumstances.
    *   Do not show a "0 locked deals" notification.
    *   The transition is silent, removing the element entirely from the DOM tree.

---

## 2. Copy & Localization Matrix (The Premium Hub Bar)

To maximize conversion without generating visual fatigue, the Hub Bar dynamically computes its copy based on the exact count ($N$) of locked deals currently present on the page.

| Metric | Target State | Primary Summary Text | Primary CTA Button Label | Accessibility / ARIA Label |
| :--- | :--- | :--- | :--- | :--- |
| **$N = 1$** | Single Locked Deal | `"1 exclusive, high-discount deal is locked below."` | `"Unlock 1 Deal"` | `"Unlock the remaining 1 exclusive premium deal found today"` |
| **$N = 2$ to $5$** | Few Locked Deals | `"Only {N} exclusive, high-discount deals are locked below."` | `"Unlock These {N} Deals"` | `"Unlock these {N} exclusive premium deals found today"` |
| **$N \ge 6$** | Many Locked Deals | `"Unlock {N} premium deals found today."` | `"Unlock All {N} Deals"` | `"Unlock all {N} exclusive premium deals found today"` |

---

## 3. Responsive Placement & Viewport Orchestration

The Sticky Hub Bar uses a hybrid position strategy designed for maximizing conversion on paid search traffic.

```
MOBILE (375px)                      DESKTOP (1280px)
┌──────────────────────────┐        ┌──────────────────────────────────────────────────┐
│                          │        │                                                  │
│  [Locked]   [Locked]     │        │  [Locked Card]    [Locked Card]    [Locked Card] │
│                          │        │                                                  │
├──────────────────────────┤        ├──────────────────────────────────────────────────┤
│ [★ 12 Deals   [Unlock] ] │        │ [★ Unlock 12 premium deals today     [Unlock] ]  │
└──────────────────────────┘        └──────────────────────────────────────────────────┘
Viewport Sticky Dock (bottom: 0)     Container-Scoped Sticky Bottom (max-width: 1200px)
```

### Mobile (375px)
*   **Placement**: Fixed viewport-docked bar anchored at `bottom-0 left-0 right-0`.
*   **Z-Index**: `z-50` to float over layout elements, cards, and navigation.
*   **Interaction/Scrolling**: To prevent banner-blindness at page-load, the bar is hidden initially. It slides up smoothly (using `translate-y-0 transition-transform duration-300`) *only* when the first locked card enters the bottom 30% of the viewport (using an `IntersectionObserver`).
*   **Safe Area**: Incorporates CSS `env(safe-area-inset-bottom)` to ensure zero collision with system home indicators on iOS/Android devices.

### Desktop (1280px)
*   **Placement**: Sticky bottom deck constrained to the horizontal boundaries of the main grid layout (`max-w-[1200px] mx-auto left-4 right-4 bottom-4`).
*   **Styling**: Floating pill-shaped bar with a glassmorphic background blur, resting gracefully over the bottom of the grid cards.
*   **Interaction**: Translates into view once the user scrolls down to the locked deals region, providing persistent context without blocking the top global navigation bar.

### UX Justification for Sticky Placement
Paid ad traffic exhibits high bounce rates. Forcing users to scroll back to the page header to find an Upgrade link after browsing locked cards introduces unnecessary friction. A persistent, contextual bottom controller reduces cognitive load and maintains a continuous path to conversion.

---

## 4. Per-Card Affordance Redesign

Each individual `LockedDealCard` receives a streamlined visual overhaul. The massive, central absolute-overlay box containing the button is removed and replaced with a elegant, integrated visual treatment.

```
┌────────────────────────────────────────────────────────┐
│  [Members] [Deal found today]          [Save 62%] ◄────│─── Unblurred Razor Badge
├────────────────────────────────────────────────────────┤
│                                                        │
│  [Blurred Photo / Hidden Property Information]         │
│                                                        │
│  [★ ★ ★ ★ ★ (Blurred Info Block)]                      │
│                                                        │
│                     ┌────────────────┐                 │
│                     │ 🔒 Premium     │ ◄───────────────│─── Micro-Affordance Link
│                     └────────────────┘                 │
└────────────────────────────────────────────────────────┘
```

1.  **Top-Right Overlay (The Value Hook)**:
    An unblurred, high-contrast, razor-sharp discount pill is positioned in the top-right corner over the blurred property photo.
    *   **Text**: `"{discountPct}% OFF"` or `"Save {discountPct}%"` (determined by data binding).
    *   **Styling**: Semi-glossy gold background with crisp, dark type.
2.  **Central Overlay (The Micro-Affordance)**:
    Instead of the heavy white card block, a lightweight micro-affordance overlay sits in the center of the details section.
    *   **Visual**: A gold key lock icon (`size={20}`) paired with the text `"Premium Only"`.
    *   **Aria-Label**: `"Locked premium deal offering {discountPct}% discount."`
3.  **Interactive Execution**:
    The entire card wraps in or acts as a semantic link (`<a href="/join">`), turning the whole card area into a hoverable, clickable hit-target. Hovering over any part of the locked card applies a subtle scale effect to the unblurred discount pill and a soft glow to the borders.

---

## 5. Integrating the Real `discountPct` Data

To honor the platform's core commitment to honesty, the exact percentage discount is loaded straight from the API. Unlike the hotel name, rating, and address, **the discount percentage is never blurred**.

```html
<!-- Example Razor Badge Implementation -->
<div className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[color:var(--gold-deep)] px-2.5 py-1 font-display text-caption font-bold uppercase tracking-wider text-[color:var(--ink)] shadow-md">
  <Icon name="tag" size={12} className="text-[color:var(--ink)]" />
  <span>Save {discountPct}%</span>
</div>
```

*   **Honesty Guardrails**: While the exact hotel image and title are safely blurred to protect proprietary business data, the unblurred discount percentage proves to the customer that the premium paywall contains high-value, calculated deals rather than dummy placeholders.

---

## 6. Interaction Architecture & Event Tracking

### Click Behaviors & Routing Matrix
Both the Sticky Hub Bar and individual `LockedDealCard` links point to `/join` but write specific query parameters to the URL to analyze the performance of each element.

```
[Sticky Bottom Hub] ────────────────────► /join?utm_source=deal_page&utm_medium=sticky_hub&deals_count=12
[Locked Deal Card (62% Off)] ───────────► /join?utm_source=deal_page&utm_medium=card_teaser&discount=62
```

*   **Sticky Hub Click**:
    *   Redirects to `/join?utm_source=deal_page&utm_medium=sticky_hub&deals_count={N}`.
    *   Tracks custom analytical event: `click_sticky_hub_unlock` (Properties: `deals_visible: N`).
*   **Card Teaser Click**:
    *   Redirects to `/join?utm_source=deal_page&utm_medium=card_teaser&discount={discountPct}`.
    *   Tracks custom analytical event: `click_card_teaser_unlock` (Properties: `discount_percent: discountPct`).

### Keyboard & Focus Handling (Accessibility Spec)
1.  **Tab Index**:
    *   The Sticky Hub CTA button must participate in the natural document tab order (`tabIndex={0}`).
    *   Individual locked cards are interactive link elements (`<a>`) with standard keyboard focus rings styled via Tailwind (`focus-visible:ring-2 focus-visible:ring-[color:var(--gold-deep)]`).
2.  **Screen Readers**:
    *   The blurred content within each locked card is hidden from the accessibility tree using `aria-hidden="true"`.
    *   The card link itself uses `aria-label="Locked premium deal. Save {discountPct}% at a hotel in {placeholderCity}. Unlock deal with Premium."`
3.  **Dismissibility**:
    *   The Sticky Hub is **not dismissible** (no close/x button). Because viewing these locked items represents a gate to premium content, the bar must remain sticky as long as locked items populate the visible grid area.

---

## 7. Tailwind & Custom Token Implementation Blueprint

Here is the implementation-ready markup and styling patterns mapping to our active design tokens.

### CORRECTIONS (verified against real code before handoff, 2026-08-15)

1. **Real regression caught:** the original draft's card JSX hardcoded `'★★★★★'`
   (5 stars) for any non-null `stars` value, instead of calling the existing
   `starChars(stars)` helper already defined in this file. That would have
   silently reintroduced the exact fabricated-rating bug Finding 1 already
   fixed earlier tonight (`stars ?? 4`) — just moved from a prop default into
   the render itself. **Fixed below: `starChars(stars)` must be called, not a
   hardcoded string.**
2. **Scroll-triggered reveal not actually implemented:** section 3 describes
   an `IntersectionObserver`-triggered slide-in for the mobile sticky bar,
   but the code blueprint below renders unconditionally whenever
   `lockedDealsCount > 0` — no observer logic is present. DEV must implement
   the actual `IntersectionObserver` (or decide unconditional-render-on-scroll-position
   is acceptable and drop the claim) — do not assume the prose description
   is already reflected in the code sample below.

### A. The Optimised `LockedDealCard.tsx`

```tsx
import { PropertyPhoto } from './PropertyPhoto'
import { Icon } from './icons/Icon'

type LockedDealCardProps = {
  placeholderName: string
  placeholderCity: string
  stars: number | null
  photoUrl?: string
  joinHref?: string
  accessibilityNeedsSelected?: boolean
  discountPct: number // Real, honest parameter now exposed
}

export function LockedDealCard({
  placeholderName,
  placeholderCity,
  stars,
  photoUrl,
  joinHref = '/join',
  accessibilityNeedsSelected = false,
  discountPct,
}: LockedDealCardProps) {
  const cardTrackingHref = `${joinHref}?utm_source=deal_page&utm_medium=card_teaser&discount=${discountPct}`

  return (
    <a 
      href={cardTrackingHref}
      className="group relative block overflow-hidden rounded-[var(--radius-card)] border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--surface)] transition-all duration-200 hover:-translate-y-1 hover:border-[color:var(--gold-deep)] hover:shadow-[var(--shadow-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--gold-deep)]"
      aria-label={`Locked premium deal. Save ${discountPct}% at a hotel in ${placeholderCity}. Unlock deal with Premium.`}
    >
      {/* Real, Unblurred Value Hook Badge */}
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--gold-deep)] px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-wider text-[color:var(--ink)] shadow-md transition-transform duration-200 group-hover:scale-105">
        <Icon name="premium_unlocked" size={10} className="text-[color:var(--ink)]" />
        <span>Save {discountPct}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <span className="rounded-[var(--radius-pill)] bg-[color:var(--primary)] px-3 py-1 font-display text-body font-bold leading-none text-[color:var(--text-inverse)]">
          Members
        </span>
        <span className="rounded-[var(--radius-pill)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-caption font-medium leading-none text-[color:var(--text-2)]">
          Deal found today
        </span>
      </div>

      {/* Honesty Blurred Photo Element */}
      <div className="px-4 pt-3 select-none blur-[6px] transition-all duration-300 group-hover:blur-[4px]" aria-hidden="true">
        <PropertyPhoto src={photoUrl} size="card" />
      </div>

      <div className="relative space-y-3 px-4 pb-4 pt-3">
        {/* Hidden Context & Micro-Affordance Overlay */}
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[color:var(--bg-overlay)] bg-opacity-10 px-4 py-4 text-center backdrop-blur-[1px] transition-all duration-200 group-hover:backdrop-blur-0">
          <div className="flex items-center gap-2 rounded-[var(--radius-input)] border border-[color:var(--line-ivory)] bg-[color:var(--surface)] px-4 py-2 shadow-sm transition-all duration-200 group-hover:border-[color:var(--gold-deep)] group-hover:shadow-md">
            <Icon name="lock" size={14} className="text-[color:var(--gold-deep)]" />
            <span className="font-display text-caption font-bold uppercase tracking-wide text-[color:var(--ink)]">Premium Only</span>
          </div>
        </div>

        {/* Blurred Meta Fields */}
        <div className="pointer-events-none select-none blur-[5px]" aria-hidden="true">
          <h3 className="text-body font-display font-bold leading-snug text-[color:var(--ink)]">{placeholderName}</h3>
          <p className="text-caption mt-0.5 leading-snug text-[color:var(--ink-faint)]">
            {stars === null ? 'Not yet rated' : starChars(stars)} · {placeholderCity}
          </p>
        </div>

        <div className="pointer-events-none select-none space-y-0.5 blur-[5px]" aria-hidden="true">
          <div className="flex items-baseline gap-2">
            <div className="h-7 w-16 rounded-[var(--radius-pill)] bg-[color:var(--primary)]" />
            <div className="h-4 w-10 rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]" />
            <div className="h-4 w-20 rounded-[var(--radius-pill)] bg-[color:var(--line-ivory)]" />
          </div>
        </div>

        {accessibilityNeedsSelected && (
          <p className="rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] px-3 py-2.5 text-caption font-medium leading-5 text-[color:var(--text-2)]">
            Accessibility fit available after this deal is unlocked.
          </p>
        )}

        <div className="pointer-events-none select-none blur-[5px]" aria-hidden="true">
          <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
            {['Expedia', 'Booking', 'Kiwi', 'Trip.com'].map(name => (
              <div key={name} className="rounded-[var(--radius-input)] border-[0.5px] border-[color:var(--line-white)] py-2 text-center text-caption font-medium text-[color:var(--ink)]">
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </a>
  )
}
```

### B. The Sticky Premium Hub Control Bar Component

```tsx
import { Icon } from './icons/Icon'

type PremiumHubBarProps = {
  lockedDealsCount: number
  joinHref?: string
}

export function PremiumHubBar({
  lockedDealsCount,
  joinHref = '/join',
}: PremiumHubBarProps) {
  // Omit execution entirely on zero states
  if (lockedDealsCount <= 0) return null

  // Localization and Dynamic Copy Engine
  let summaryText = `Unlock ${lockedDealsCount} premium deals found today.`
  let buttonLabel = `Unlock All ${lockedDealsCount} Deals`

  if (lockedDealsCount === 1) {
    summaryText = "1 exclusive, high-discount deal is locked below."
    buttonLabel = "Unlock 1 Deal"
  } else if (lockedDealsCount >= 2 && lockedDealsCount <= 5) {
    summaryText = `Only ${lockedDealsCount} exclusive, high-discount deals are locked below.`
    buttonLabel = `Unlock These ${lockedDealsCount} Deals`
  }

  const hubTrackingHref = `${joinHref}?utm_source=deal_page&utm_medium=sticky_hub&deals_count=${lockedDealsCount}`

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 w-full px-0 pb-[env(safe-area-inset-bottom)] md:bottom-4 md:px-4">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 border-[0.5px] border-[color:var(--line-ivory)] bg-[color:var(--bg-overlay)] px-6 py-4 shadow-2xl backdrop-blur-md md:rounded-[var(--radius-card)] md:flex-row md:py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--gold-deep)] text-[color:var(--ink)] shadow-inner">
            <Icon name="premium_unlocked" size={20} />
          </div>
          <div>
            <p className="text-body font-display font-bold leading-tight text-[color:var(--ink)]">
              {summaryText}
            </p>
            <p className="text-caption hidden mt-0.5 text-[color:var(--ink-soft)] md:block">
              Premium members save up to 75% on hand-verified properties.
            </p>
          </div>
        </div>

        <a
          href={hubTrackingHref}
          className="btn btn-conversion w-full text-center font-display text-body font-bold tracking-wide md:w-auto md:px-8 md:py-3"
          aria-label={`Unlock all ${lockedDealsCount} exclusive premium deals found today`}
        >
          {buttonLabel}
        </a>
      </div>
    </div>
  )
}
```