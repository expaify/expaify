---
id: UXDES-DEAL-PAGE-FIX-001
stage: UXDES
depends_on: UXR-DEAL-PAGE-FIX-001
---

# Design Spec: Deal Detail Page Gaps

## 1. Fix Kiwi OTA link

**Problem:** Kiwi link is a flight search URL. Must be hotel-specific.

**Action:** Audit the kiwi URL format in `lib/pipeline/providers/`. If `kiwi.com` does not offer a direct hotel search deep-link, **remove kiwi from the provider list** in `CompareRow` and stop generating kiwi entries in `ota_links`. Do not replace with a broken link.

**If Kiwi can deep-link hotels**, correct URL template:
```
https://www.kiwi.com/en/search/results/{city}/{city}/{checkIn}/{checkOut}?accommodation=true&adults=2
```
Verify this opens a hotel results page (not flight results) before shipping.

**Fallback decision:** If in doubt, remove kiwi. Three trustworthy providers (Booking, Expedia, Trip.com) are better than four where one is wrong.

## 2. Affiliate params on OTA deeplinks

All `ota_links` URLs must include affiliate tracking before leaving the server.

**Booking.com:** Append `&aid={TP_AFFILIATE_MARKER}` (or the Booking.com affiliate ID from env).  
**Expedia:** Append `&affcid={EXPEDIA_AFFILIATE_ID}` if available; otherwise log a warning.  
**Trip.com:** Add referral param per their API docs.

This is a DEV-stage change in the pipeline link builder, not a UI change.

## 3. Sparkline — 3-point minimum

**File:** `app/deals/[dealId]/page.tsx:153`

**Current:** `{history.length >= 2 && ( <section>60-day price history</section> )}`

**Change to:** `{history.length >= 3 && ( <section>60-day price history</section> )}`

When fewer than 3 points, show only the TrustLine with updated copy (see §5 below).

No other change to the sparkline component.

## 4. Branded not-found page

**New file:** `app/deals/[dealId]/not-found.tsx`

```
[expaify·]                          ← same logo as other pages

        This deal has expired.

  We update our feed daily — there are
  usually hundreds of active deals.

  [  Browse current deals  ]        ← btn btn-primary → /deals
```

**Spec:**
- Centred layout, `min-h-screen`, `bg-[color:var(--bg)]`
- Logo: same `<a href="/">` lockup as detail page nav
- Icon: clock SVG (24×24, `stroke="var(--primary)"`, same style as other icon blocks)
- Heading: `font-display text-[26px] font-bold text-[color:var(--ink)]` — "This deal has expired."
- Body: `text-[15px] text-[color:var(--ink-soft)] mt-3 max-w-[320px] text-center` — "We update our feed daily — there are usually hundreds of active deals."
- CTA: `btn btn-primary mt-6 px-8` — "Browse current deals" → `/deals`
- No secondary CTA needed.

**How to trigger:** Next.js App Router calls `not-found.tsx` when the closest server component calls `notFound()`. No additional config needed.

## 5. TrustLine copy for low snapshot count

**File:** `app/components/ui/TrustLine.tsx`

**Current copy (any count):** "Based on {n} price checks · updated daily"

**New copy when `snapshotCount <= 2`:**
"Early deal — tracked {n} times so far. Confidence grows as we check daily."

**New copy when `snapshotCount >= 3`:**
Keep existing: "Based on {n} price checks · updated daily"

**Prop change:** `TrustLine` already receives `snapshotCount: number`. Add conditional rendering inside the component — no API or page changes needed.

## Interaction rules
- Not-found page: "Browse current deals" uses `<a href="/deals">` (not client router) — static HTML, no JS dependency
- Sparkline guard change: server-side conditional, no client state change
- TrustLine copy: pure render logic, no new props
- Affiliate params: pipeline layer only — UI components receive the final URL and do not construct it

## States covered
| State | Before | After |
|-------|--------|-------|
| Real deal, ≥3 history points | Sparkline shows | Sparkline shows (unchanged) |
| Real deal, 2 history points | 2-point "crash" chart | TrustLine only with honest copy |
| Deal ID not in DB | Default Next.js 404 | Branded expaify not-found |
| Kiwi link clicked | Flight search page | Removed or correct hotel search |
| Booking/Expedia click | No affiliate param | Affiliate param in URL |

## Files to change
| File | Change |
|------|--------|
| `app/deals/[dealId]/page.tsx` | `history.length >= 2` → `>= 3` |
| `app/deals/[dealId]/not-found.tsx` | New file — branded not-found |
| `app/components/ui/TrustLine.tsx` | Conditional copy for snapshotCount ≤ 2 |
| `lib/pipeline/…` (link builder) | Affiliate params + fix/remove kiwi (DEV stage) |
