# UXD: Brand Icon Set — Discovery

## User pain point
Every surface that needs a small visual marker (watchlist, alerts, savings verification, pricing history, premium gating, privacy) hand-rolls its own inline `<svg>` at a different size, stroke-width, and viewBox, so the site has no consistent visual language for the trust and tracking concepts that are core to its "hotel price intelligence" positioning — new concepts like verified savings or no-hidden-fees currently have no icon at all and would be improvised ad hoc, further eroding consistency.

## Who is affected and where
First-time and returning users scanning for trust signals across the whole browsing flow, not one isolated screen:
- **Results/deal cards** (`DealCard.tsx`, `HotelCard.tsx`) — deal alerts, verified savings, hotel deals markers
- **Watchlist UI** (`WatchCityPill.tsx`) — watchlist/tracking icon, already improvised as a plus/check pair
- **Price detail** (`PriceSparkline.tsx` context) — price history has no dedicated icon, only a chart
- **Alert signup / account** (price-alert-signup surfaces) — email alerts icon
- **Paywall / premium gating** (`LockedDealCard.tsx`) — premium unlocked deals icon
- **Booking links / OTA comparison** (`CompareRow.tsx`, deal links) — direct booking, marketplace comparison icons
- **Trust/footer copy** (`TrustLine.tsx`) — no hidden fees, privacy/no ad trackers icons

## Measurable signal
- `grep -rln "<svg" app/components/` returns 19 files, each defining its own inline markup — no shared icon component or registry exists anywhere in `app/` or `lib/`.
- Existing inline icons are visually inconsistent: `ShareButton.tsx` uses `viewBox="0 0 24 24"` / `strokeWidth="2"`, `WatchCityPill.tsx` uses `viewBox="0 0 16 16"` / `strokeWidth="1.75"`, `TrustLine.tsx` uses filled bars in a `viewBox="0 0 10 10"` with no stroke at all, `StarRow.tsx` uses `viewBox="0 0 12 11"` — four different geometries for what should read as one family.
- No `lucide-react`, `react-icons`, `heroicons`, or any icon package is installed (`package.json` has none of these), so every new concept gets a bespoke, unreviewed SVG unless a shared set exists.
- Of the 12 target concepts (deal alerts, watchlist, price history, verified savings, email alerts, destination tracking, direct booking, no hidden fees, marketplace comparison, premium unlocked deals, privacy/no ad trackers, hotel deals), at most 2 (watchlist, hotel deals) have any existing improvised icon; the other 10 have none.

## Constraints
1. **Brand**: Icons must use only existing tokens confirmed in `app/globals.css` `:root` — primary teal `--primary` (`#0E5A54`), ink `--ink`/`--ink-soft`/`--ink-faint` for neutral strokes, `--gold`/`--gold-deep` reserved for discount/premium accents, `--accent` reserved for CTA-adjacent use per existing convention (coral, used sparingly). No new hex values, no new color tokens.
2. **Accessibility**: Icons are decorative-by-default (`aria-hidden="true"` + `focusable="false"`, matching the existing `TrustLine.tsx` pattern) unless standing alone as an interactive control, in which case the parent control needs an `aria-label` — never bake meaning into the icon alone. Stroke-based icons must render legibly at the smallest in-use size (16px, per `WatchCityPill.tsx` precedent) without stroke-width dropping below ~1.5px at that scale.
3. **Consistency/data integrity**: A single shared geometry contract (one viewBox, one stroke-width, one corner-radius/line-cap style — "rounded-line" per the brand board) across all 12 icons, delivered as one reusable component/registry rather than 12 more one-off inline SVGs, so the next surface that needs one of these concepts pulls from the set instead of re-inventing it.

## Success statement
This is solved when any engineer implementing a new surface (results card, watchlist row, alert settings, paywall gate, footer trust line) can import one of the 12 icons from a single shared source, get consistent sizing/stroke/color behavior out of the box using only existing design tokens, and a first-time user scanning the site sees one coherent visual language for trust and tracking concepts — without encountering a mismatched, missing, or emoji-substituted icon anywhere in the flow.
