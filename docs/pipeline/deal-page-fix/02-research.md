---
id: UXR-DEAL-PAGE-FIX-001
stage: UXR
depends_on: UXD-DEAL-PAGE-FIX-001
---

# Research: Deal Detail Page — Current State Audit

## Status of original P0 bugs

Both bugs from the discovery report are resolved:

| Bug | Fix | Verified |
|-----|-----|---------|
| MIN_SNAPSHOTS=8 → no real deals | Lowered to 2; seed script ran | 1,911 real deals in DB (`is_mock=false`) |
| Mock cards have no href | `DealCard` only sets `href` when `!deal.isMock` | All 1,911 real deals get `href="/deals/{id}"` |

The deal detail page (`/deals/[id]`) **loads for real deals**. The server component queries `getDealById`, joins `tracked_markets` for city, and renders price block + OTA compare row + optional sparkline. No 404 on real deal IDs.

---

## Implementation audit

### Feed → detail navigation (`app/deals/DealFeed.tsx:283`)
```tsx
href={deal.isMock ? undefined : `/deals/${deal.id}`}
```
Real deals are clickable. Locked deals render `LockedDealCard` (no href). ✓

### Detail page data (`app/deals/[dealId]/page.tsx`)
- Calls `getDealById(id)` → returns null → `notFound()` (Next.js default 404, not branded)
- Calls `getPriceHistory(hotel_id, marketId)` → passes when `rows.length >= 2`
- Renders: hero image, title block, price block, CompareRow, "Why this is a deal" grid, sparkline (conditional), TrustLine

### OTA links (`app/components/ui/CompareRow.tsx`)
- Renders 4 providers: Expedia, Booking, Kiwi, Trip.com
- Links with href → clickable; without href → greyed out placeholder ✓
- All links tagged `rel="noopener noreferrer sponsored"` ✓
- **Gap: no affiliate tracking params** on any outbound link — AGENTS.md mandates affiliate markers on all deeplinks

### Kiwi link template (pipeline seed data)
Real deal sample:
```json
"kiwi": "https://www.kiwi.com/en/search/results/Nashville/Nashville/2026-08-31/2026-09-02?adults=2&accommodation=true"
```
This is a **flight search URL** (kiwi.com/search/results/{origin}/{destination}). Hotel detail page shows a flight search link. User clicks "Kiwi" → lands on a flight results page → immediate trust loss.

### Price history sparkline
All seeded deals have exactly 2 snapshot dates (today + yesterday seed). Sparkline renders with 2 points — a near-vertical line showing yesterday's inflated price (~2x) dropping to today's deal price. Technically accurate but visually reads as "extreme overnight crash" which looks artificial and erodes trust.

### Not-found handling
`getDealById` returns null → `notFound()` → Next.js default 404 page. No expaify branding, no "Back to deals" CTA. Users who land on an expired or invalid deal ID have no recovery path.

---

## Reference patterns

**Booking.com deal detail:** Price history hidden when < 7 days of data. "We don't have enough data" shown instead of a 2-point chart. Error/not-found always shows "Search for other properties" CTA.

**Google Hotels:** Deep-links to hotel-specific pages, not generic search. Affiliate/tracking params embedded in every outbound booking URL.

**Expedia:** Custom 404 with search bar pre-filled with the destination — user stays in the funnel.

---

## Gap analysis

| Gap | Severity | Impact |
|-----|----------|--------|
| Kiwi link is a flight search URL | High | User confusion, wrong destination after click |
| No affiliate params on OTA deeplinks | High | Revenue loss on every booking click |
| 2-point sparkline looks artificial | Medium | Erodes deal credibility with early users |
| No branded 404 for expired/invalid deal IDs | Medium | Dead end — user leaves site |
| Default Next.js 404 has no recovery CTA | Medium | Funnel exit on bad URLs |

---

## Design directives

1. **Fix Kiwi URL template** — Replace the kiwi link with a hotel search URL:
   `https://www.kiwi.com/en/search/results/{city}/{city}/{checkIn}/{checkOut}?adults=2&accommodation=true`
   is already hotel-accommodation search intent; verify it lands on a hotel-results page. If Kiwi does not support hotel search, remove kiwi from `CompareRow` provider list. Do not show a link that goes to the wrong product type.

2. **Add affiliate params to all OTA deeplinks** — Per AGENTS.md, every outbound booking URL must carry the affiliate marker. Add TP affiliate params to Booking.com and Expedia links when building `ota_links` in the pipeline. (Kiwi and Trip.com links should also include referral params if available.)

3. **Hide sparkline when fewer than 3 distinct snapshot dates** — A 2-point chart is not price history; it's a single delta. Change `history.length >= 2` guard to `>= 3`. Show only TrustLine when fewer than 3 points, with copy: "More price history builds up as we track this hotel daily."

4. **Add branded not-found page** — Create `app/deals/[dealId]/not-found.tsx` with the expaify nav, a human error message ("This deal has expired or isn't available"), and a primary CTA "Browse current deals" → `/deals`. Replaces the default Next.js 404.

5. **Trust line copy when snapshot_count = 2** — Current: "Based on 2 price checks." Update to "Early deal — we've checked this hotel 2 times. Confidence grows with more data." This sets correct expectations without hiding the low data count.
