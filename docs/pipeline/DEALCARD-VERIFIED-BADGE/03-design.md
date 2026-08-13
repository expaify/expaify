# UX/Interaction Design Specification: Trust-Anchor Integration (Stage 3)

## 1. Imports and Dependencies
To render the high-contrast, multi-modal icon, the system icon component must be imported. Ensure the following line is added at the top of `DealCard.tsx` under other imports:

```tsx
import { Icon } from '@/app/components/ui/Icon'
```

---

## 2. Dynamic Trust Logic Gate (TypeScript)
Insert this logic directly block-adjacent to the existing compute blocks (`showSavings`, `checked`, etc.) in the `DealCard` component function:

```typescript
  // Trust Resolution Gate: Verify sufficient snapshot volume, fresh updates, and high discount magnitude
  const isFresh = deal.updatedAt
    ? (Date.now() - new Date(deal.updatedAt).getTime()) < 36 * 60 * 60 * 1000 // 36 hours in milliseconds
    : false

  const showVerifiedBadge =
    !deal.isMock &&
    !deal.expired &&
    deal.snapshotCount >= 12 &&
    deal.discountPct >= 15 &&
    isFresh
```

---

## 3. Visual Layout & Target Code Insertion
To guarantee optimal cognitive alignment without causing layout shifts, the Trust Pill is inserted immediately inside the pricing flex container. 

The pill coexists with `DealChip` (which visualizes discount magnitude), rendering directly after it. This structural sequence presents the value proposition first, instantly followed by the trust validation.

### Exact Replace Segment
Locate lines 129–145 of `DealCard.tsx` and replace them with this exact code block:

```tsx
        <div className="space-y-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-2">
            <span className="text-h2 leading-none text-[color:var(--primary)]">
              {formatMoney(deal.dealPrice)}
            </span>
            <span className="text-caption self-end pb-0.5 leading-none text-[color:var(--ink-faint)]">/ night</span>
            <span className="text-small leading-none text-[color:var(--ink-faint)] line-through">
              usually {formatMoney(deal.medianPrice)}
            </span>
            {deal.expired ? (
              <span className="inline-flex items-center rounded-[var(--radius-pill)] bg-[color:var(--bg-muted)] px-3 py-1.5 font-display text-small font-bold leading-none text-[color:var(--ink-soft)]">
                Expired
              </span>
            ) : (
              <>
                <DealChip discountPct={deal.discountPct} />
                {showVerifiedBadge && (
                  <div 
                    className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--bg-muted)] px-2 py-1 text-caption font-bold text-[color:var(--primary)] self-center"
                    role="status"
                    title={`Verified savings based on ${deal.snapshotCount} independent price checks.`}
                    aria-label={`Price verified by expaify. Based on ${deal.snapshotCount} independent price checks over the past 60 days.`}
                  >
                    <Icon name="verified_savings" size={16} className="text-[color:var(--primary)]" />
                    <span>Price Verified</span>
                  </div>
                )}
              </>
            )}
          </div>
```

---

## 4. State Matrix and Fallbacks

| Layout State | Trigger Condition | Badge Status | Visual & Structural Behavior | Justification |
| :--- | :--- | :--- | :--- | :--- |
| **Default (Verified)** | `snapshotCount >= 12` AND `discountPct >= 15` AND `updatedAt < 36h` | **Rendered** | Appears immediately to the right of `DealChip`. Vertically aligned to center via `self-center`. | Establishes immediate cognitive alignment by wedding the "too-good-to-be-true" claim to empirical validation metrics in a single visual sweep. |
| **Gated-Off** | Any criteria under Default is unmet | **Hidden** | No pill is rendered. Standard line height and flex spacing are preserved without Cumulative Layout Shift (CLS). | Prevents weak or unrepresentative signals (e.g., verifying a deal based on only 1 or 2 historical snapshots) from undermining platform integrity. |
| **Mock Card** | `deal.isMock === true` | **Hidden** | Explicitly bypassed; only the "Example" tag renders. | Trust indicators must never display on simulated datasets, preserving programmatic and brand integrity. |
| **Expired Card** | `deal.expired === true` | **Hidden** | The grayed-out "Expired" pill renders in place of action blocks; the trust badge is bypassed. | Once a deal is no longer bookable, validations are functionally obsolete; suppressing the badge reduces cognitive clutter on inactive components. |

---

## 5. Token & Design System Standards
*   **Colors**: Uses the approved background token `bg-[color:var(--bg-muted)]` and standard primary system token `text-[color:var(--primary)]` for high-contrast visibility ($\ge 4.5:1$ WCAG 2.1 AA requirement).
*   **Border Radius**: Inherits standard pill geometry matching `DealChip` via `rounded-[var(--radius-pill)]`.
*   **Layout Safety**: Designed as an `inline-flex` block with explicit `px-2 py-1` height-caps to ensure its container fits flush inside the pre-existing vertical card flow, preventing vertical layout shift under all viewport variations.