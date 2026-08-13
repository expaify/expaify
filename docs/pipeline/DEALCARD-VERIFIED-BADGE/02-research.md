### 1. Competitive Heuristic Evaluation: Current vs. Reference Trust Patterns

To understand why value-conscious travelers dismiss high-discount deals on expaify, we evaluate our interface against trust-anchor paradigms used by category leaders (Google Flights, Booking.com, and Expedia). 

#### Cognitive Friction & Proximity Analysis
```
Google Flights Pattern:
[ $240 / night ] ── (Adjacent) ── [ ✓ Price Guarantee Badge ] ── (Tooltip on Hover) ── [ Full Methodology & Historical Chart ]
Result: Immediate cognitive alignment. The proof is welded to the claim.

expaify Current Pattern:
[ $240 / night ] ── (Usually $380 / night) ── [ Save 36% Chip ]
  ... [ Break of 4-5 visual lines of hotel metadata, disruptions, and CTAs ] ...
[ Based on 112 price checks over 60 days... ] (Faint text, no visual anchor)
Result: High cognitive load. The user sees a "too good to be true" discount and immediately rejects it before reading the footnote.
```

#### The Exact Delta
| UX Heuristic / Dimension | Category-Standard Reference Pattern (e.g., Google Flights) | expaify Current Implementation (`DealCard.tsx`) | The Trust Delta |
| :--- | :--- | :--- | :--- |
| **Proximity of Proof** | Trust badges (e.g., "Price Guarantee" or "Price Tracked") are placed **immediately adjacent** to the promotional price to preemptively defuse skepticism. | The pricing cluster displays the discount, but the empirical proof of verification is buried in the bottom footer, separated by multiple layout blocks. | **Severe Proximity Gap:** The claim and the proof are not visually grouped, preventing users from making a logical connection between the 30%+ discount and the data. |
| **Asymmetric Validation** | Verification is **conditional**. A badge only renders if data meets rigorous criteria (e.g., high historical snapshot frequency and low price volatility). | The raw metric `"Based on X price checks..."` displays unconditionally for all non-mock, active deals—even if `snapshotCount` is critically low (e.g., 1 or 2 checks). | **Deceptive/Weak Signal:** Displaying a low snapshot count as "proof" actually confirms to suspicious users that the deal lacks historical backing. |
| **Semantic Iconography** | Uses explicit, authoritative visual metaphors (e.g., shields, ticks, or graphs) to anchor the trust status instantly. | Relying entirely on text strings without graphical weight or visual structure. | **Low Visual Saliency:** Text-only statements look like platform boilerplate or legal disclaimers rather than an active, real-time certification. |

---

### 2. Testable UX Design Directives

To resolve user skepticism without causing Cumulative Layout Shift (CLS) or visual clutter, implement these four precise, testable design directives within `DealCard.tsx`.

#### Directive 1: Dynamic Trust Resolution (The Logic Gate)
The platform must never show a trust badge unless the underlying dataset proves historical integrity. 
*   **Trigger Condition:** 
    *   The deal must have a `deal.snapshotCount >= 12` (minimum sample size representing regular monitoring over the 60-day window).
    *   The deal's price change must be fresh: `deal.updatedAt` must be non-null and fall within the last 36 hours.
    *   The savings must be significant: `deal.discountPct >= 15%`.
*   **Fallback Behavior:** If these criteria are not met, do not show the verified badge. The bottom informational text can remain as a secondary subtitle, but no trust pill will render.

#### Directive 2: Visual Placement & Hierarchy Budget
*   **Placement:** Insert the verification pill directly into the existing flex-wrap container hosting the primary price and `DealChip`:
    ```tsx
    // Target insertion point in DealCard.tsx (Line 131)
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="text-h2 leading-none text-[color:var(--primary)]">
        {formatMoney(deal.dealPrice)}
      </span>
      {/* Proposed insertion slot immediately after price metadata/chips */}
    </div>
    ```
*   **Visual Style:** A compact, high-contrast, non-disruptive pill that mirrors the layout footprint of `DealChip`. It must not expand the vertical layout boundaries of the `DealCard`.

#### Directive 3: High-Contrast, Multi-Modal Iconography (WCAG 2.1 AA)
*   **Icon Selection:** Use the pre-shipped `verified_savings` icon from the shared `Icon` component.
*   **Color & Styling:** 
    *   Do not rely solely on color (e.g., green text) to convey trust. Use a high-contrast background token `bg-[color:var(--bg-muted)]` with high-contrast text and icon colors matching the platform's primary brand identifier: `text-[color:var(--primary)]` or `text-[color:var(--ink)]`.
    *   This ensures readability on both light and dark themes while satisfying WCAG 2.1 AA contrast requirements ($\ge 4.5:1$).

#### Directive 4: Contextual Microcopy & Screen-Reader Experience
*   **Visual Copy:** `Verified Value` or `Price Verified`.
*   **Aria-Labeling & Tooltip:** Provide the required empirical evidence directly inside an explicit `aria-label` for screen readers, and map it to a native HTML `title` attribute for desktop hover interactions.
    *   **String Template:** `"Price verified by expaify. Based on {deal.snapshotCount} independent price checks over the past 60 days."`
*   **DOM Structure:**
    ```tsx
    <div 
      className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[color:var(--bg-muted)] px-2 py-1 text-caption font-bold text-[color:var(--primary)]"
      role="status"
      title={`Verified savings based on ${deal.snapshotCount} independent price checks.`}
      aria-label={`Price verified by expaify. Based on ${deal.snapshotCount} independent price checks over the past 60 days.`}
    >
      <Icon name="verified_savings" size={16} className="text-[color:var(--primary)]" />
      <span>Price Verified</span>
    </div>
    ```