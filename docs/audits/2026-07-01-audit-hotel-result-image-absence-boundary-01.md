# AUDIT-HOTEL-RESULT-IMAGE-ABSENCE-BOUNDARY-01

Date: 2026-07-01
Role: Senior QA Engineer
Scope: Hotel result image presence, absence handling, alt text, provider provenance, and state review. Audit only; no production feature code changed.

## Files Inspected

- `app/page.tsx`
- `app/components/HotelCard.tsx`
- `app/api/search/route.ts`
- `lib/providers/hotellook.ts`
- `lib/providers/index.ts`
- `lib/types.ts`
- `lib/providers/__tests__/hotellook.test.ts`

Requested file mismatch:

- `components/hotels/HotelResults.tsx` does not exist in this worktree.
- `components/hotels/HotelCard.tsx` does not exist in this worktree.
- `lib/providers/hotels.ts` does not exist in this worktree.
- Actual hotel card surface is `app/components/HotelCard.tsx`.
- Actual hotel provider surface is `lib/providers/hotellook.ts`.

## Image Source Inventory

| Image field/state | Source | Provider or UI fallback? | Audit result |
| --- | --- | --- | --- |
| `HotelOffer.photoUrl` | `lib/types.ts` declares optional `photoUrl?: string` on `HotelOffer`. | Shared provider contract. | Passing boundary shape: image is optional, not required for hotel supply. |
| Live hotel image URL | `lib/providers/hotellook.ts` maps `entry.photoUrl || undefined` into `photoUrl`. | Provider data from HotelLook only. | Passing provenance: no UI-generated hotel image URL observed. |
| Rendered image | `app/components/HotelCard.tsx` renders `<img src={hotel.photoUrl} alt={hotel.name} loading="lazy">`. | Provider data rendered by UI. | Partially passing: present provider image has hotel-name alt text, but URL validity is not checked. |
| Missing image fallback | `app/components/HotelCard.tsx` renders text `Hotel photo unavailable`. | UI fallback, no image asset. | Passing honesty: no stock, AI, decorative, or fake placeholder hotel image observed. |
| Loading image area | `app/page.tsx` renders `HotelSkeleton` with shimmer blocks. | UI loading state. | Passing for non-fake data: skeleton does not invent hotel names, prices, or photos. |

## Findings

### P1: Broken hotel image URLs render as a failed image area with no honest fallback

Evidence:

- `HotelCard` treats any truthy `hotel.photoUrl` as renderable and immediately emits an `<img>` at `app/components/HotelCard.tsx:189` to `app/components/HotelCard.tsx:197`.
- There is no `onError`, URL validation, or state transition to the missing-image fallback at `app/components/HotelCard.tsx:189` to `app/components/HotelCard.tsx:202`.
- `HotellookProvider` passes `entry.photoUrl || undefined` through without validating URL syntax, protocol, or image loadability at `lib/providers/hotellook.ts:102` to `lib/providers/hotellook.ts:114`.

Repro:

1. Return or cache a hotel row with `photoUrl: 'https://example.invalid/broken-hotel.jpg'`.
2. Render the hotel card.
3. Observe the card chooses the image branch because `hotel.photoUrl` is truthy.
4. When the network image fails, the user sees the browser broken-image rendering over the muted image container, not the honest `Hotel photo unavailable` state.

Expected: if an image URL fails to load, the card should degrade to a clear "Hotel photo unavailable" state without implying a verified photo exists.

Actual: broken URLs stay in the provider-image branch.

Impact: Trust risk for paid users. The product avoids fake imagery when `photoUrl` is absent, but broken provider imagery can still make the result feel unverified or cheap.

### P2: Present hotel image alt text is only the hotel name, not a provenance-safe description

Evidence:

- Present images use `alt={hotel.name}` at `app/components/HotelCard.tsx:192` to `app/components/HotelCard.tsx:195`.
- `HotelOffer` has no field that distinguishes verified property image, room image, exterior image, generic image, or provider image metadata at `lib/types.ts:48` to `lib/types.ts:56`.
- HotelLook adapter passes only `photoUrl`, not image provenance or caption metadata, at `lib/providers/hotellook.ts:102` to `lib/providers/hotellook.ts:114`.

Repro:

1. Return a hotel with a valid `photoUrl`.
2. Inspect the rendered image.
3. The alt text is exactly the hotel name.

Expected: alt text should describe the represented hotel image when known, or remain honest about uncertainty when only provider-supplied image URL is available.

Actual: alt text names the hotel but does not make the image's verification boundary explicit.

Impact: Medium. This is not fake imagery, but it can overstate confidence if HotelLook returns a generic, stale, or mismatched property image.

### P2: Slow hotel image loading has no explicit image-level state after card content appears

Evidence:

- The image uses native lazy loading at `app/components/HotelCard.tsx:192` to `app/components/HotelCard.tsx:196`.
- The image container has a muted background at `app/components/HotelCard.tsx:190`, but no loading label or image-specific skeleton after the hotel card renders.
- The page-level hotel skeleton appears while search is running at `app/page.tsx:1437` to `app/page.tsx:1450`; once a hotel card is rendered, slow image loading is handled only by browser image loading.

Repro:

1. Return a hotel with a valid but slow `photoUrl`.
2. Render the hotel card before the image completes.
3. The card content and CTA are visible while the image area remains a blank muted block until the image finishes.

Expected: image absence/loading should remain visually intentional and trustworthy while the property photo is pending.

Actual: slow image loading can look like an empty or broken visual area.

Impact: Medium-low. Booking action remains visible, but image trust is weak under slow provider/CDN behavior.

## Passing Checks

- No fake hotel imagery observed. Missing `photoUrl` renders text fallback only at `app/components/HotelCard.tsx:199` to `app/components/HotelCard.tsx:202`.
- No decorative placeholder image observed. The fallback is a plain product state, not stock or generated media.
- Provider boundary is mostly respected. Hotel images originate from `entry.photoUrl` in `lib/providers/hotellook.ts`; UI components do not invent image URLs.
- Empty hotel states do not invent cards or images. `/api/search` streams `hotel-status: empty` when HotelLook returns no hotels at `app/api/search/route.ts:292` to `app/api/search/route.ts:297`; the page renders the hotel empty panel at `app/page.tsx:1452` to `app/page.tsx:1471`.
- Hotel provider unavailable states do not invent imagery. `/api/search` streams safe unavailable copy at `app/api/search/route.ts:298` to `app/api/search/route.ts:323`; the page can render `Hotels unavailable` instead of fake cards.
- Mobile source review is directionally sound: hotel result grid is one column below `sm` at `app/page.tsx:1437` and `app/page.tsx:1473`; image containers use full card width at `app/components/HotelCard.tsx:190` and `app/components/HotelCard.tsx:200`; CTA stacks below price on mobile at `app/components/HotelCard.tsx:248` to `app/components/HotelCard.tsx:263`.
- Desktop source review is directionally sound: hotel grid expands to three columns at `lg` at `app/page.tsx:1437` and `app/page.tsx:1473`; image containers keep fixed heights, reducing layout shift.

## State Coverage

Loading:

- Page-level hotel loading renders `HotelSkeleton` cards, including a top shimmer block shaped like an image region at `app/page.tsx:253` to `app/page.tsx:265`.
- No provider image URL is invented during loading.

Empty:

- If provider returns `ok: true` with no data, `/api/search` emits `hotel-status: empty` at `app/api/search/route.ts:296` to `app/api/search/route.ts:297`.
- UI renders a hotel empty panel, not fake hotel cards, at `app/page.tsx:1452` to `app/page.tsx:1471`.

Error/unavailable:

- Provider errors become `hotel-status: unavailable` at `app/api/search/route.ts:298` to `app/api/search/route.ts:323`.
- No hotel images or cards are rendered for unavailable hotel provider state unless earlier hotel data already exists.

Present image:

- Truthy `hotel.photoUrl` renders as `<img src={hotel.photoUrl} alt={hotel.name}>`.
- Image is provider-sourced, but not validated.

Missing image:

- Falsy `hotel.photoUrl` renders `Hotel photo unavailable`.
- This is honest, non-decorative, and avoids fake imagery.

Broken image:

- Broken but truthy URL stays in the `<img>` branch.
- No fallback transition was found.

## Manual Verification and Screenshot Blockers

Required desktop/mobile screenshot verification could not be completed in this sandbox.

Blockers:

- `npm run dev -- --hostname 127.0.0.1 --port 3000` failed with `listen EPERM: operation not permitted 127.0.0.1:3000`.
- `playwright`, `@playwright/test`, and `puppeteer` are not installed or resolvable in this worktree.
- `TP_TOKEN`, `HOTEL_AFFILIATE_ID`, and `TP_AFFILIATE_MARKER` are unset in the shell environment, so a provider-backed hotel search with at least one live hotel result cannot be produced here without external credentials.

Manual verification not completed:

- Desktop browser verification of a hotel search with at least one hotel result.
- Mobile 375px browser verification of hotel image fit and action visibility.
- Screenshot capture for empty, loading, error, mobile 375px, and desktop hotel states.

Source-level review was completed for those states, but that does not satisfy the screenshot acceptance criterion.

## Out-of-Scope Notes

- Did not add stock photos, AI-generated images, placeholder media, a CDN, or a new image provider.
- Did not redesign the hotel card.
- Did not change Deal Score, booking, affiliate handoff, or provider behavior.
- Did not touch ops-board or ticketing surfaces.

## Verification

- `npm run dev -- --hostname 127.0.0.1 --port 3000` - blocked by sandbox port binding: `listen EPERM`.
- `node -e "for (const m of ['playwright','@playwright/test','puppeteer']) ..."` - confirmed browser automation packages unavailable.
- `node -e "for (const k of ['TP_TOKEN','HOTEL_AFFILIATE_ID','TP_AFFILIATE_MARKER']) ..."` - confirmed hotel provider credentials unset in shell environment.
- `npx tsc --noEmit --incremental false` - passed.
- `npx tsc --noEmit` - passed.
- `npm test -- --runInBand` - passed: 20 suites, 176 tests.
- `npm test -- --passWithNoTests` - passed: 20 suites, 176 tests.

## Required Return Note

- What changed and why: Added this audit report for hotel image provenance, absence handling, alt text, and broken/slow image trust boundaries.
- Files changed: `docs/audits/2026-07-01-audit-hotel-result-image-absence-boundary-01.md`.
- Verification commands and results: `npx tsc --noEmit --incremental false` passed; `npx tsc --noEmit` passed; `npm test -- --runInBand` passed with 20 suites and 176 tests; `npm test -- --passWithNoTests` passed with 20 suites and 176 tests. Browser/server verification was blocked as documented.
- Out-of-scope findings or blockers: Browser screenshot/manual result verification blocked by sandbox port binding, missing browser automation packages, and absent hotel provider credentials.
