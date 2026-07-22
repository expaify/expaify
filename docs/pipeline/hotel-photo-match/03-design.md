# UX Design: Hotel and Room Photo Match

Ticket: `UXDES-HOTEL-PHOTO-MATCH-01`  
Stage: UX Design  
Priority: P1  
Date: 2026-07-22

## Inputs and scope

- Discovery: `docs/pipeline/hotel-photo-match/01-discovery.md`
- Research: `docs/pipeline/hotel-photo-match/02-research.md` was not present in this worktree. The completed upstream brief was read from the isolated UXR worktree and is treated as the research of record, as the assigned ticket directs.
- Affected surfaces only:
  - `app/components/HotelCard.tsx`, collapsed and expanded
  - `app/components/ui/DealCard.tsx`
  - `app/deals/[dealId]/page.tsx`, hotel deal hero
  - `app/components/ui/LockedDealCard.tsx`
  - `app/components/__tests__/scorePresentation.test.tsx`
- Existing data only: one optional `photoUrl` / `photo_url`. There is no photo category, room association, rate association, source, captured date, or gallery.

This is a trust repair, not a gallery feature. It changes photo semantics, framing, ordering, and absence handling. It does not change provider contracts, photo selection, Deal Score logic, rate copy, or booking logic.

## Design outcome

A traveler can distinguish a generic property-level image from the room or rate being offered. Every successful image render is visibly labeled `Property photo`; every absent or failed image uses `Photo unavailable`; no photo is named as the hotel, described as a room, or presented as current or verified. Price and Deal Score evidence lead the decision hierarchy, and all price/deal recency chips sit outside the photo.

## Non-negotiable semantic rules

### D1 — one alt rule

Every image sourced from the existing single hotel photo field uses:

```tsx
alt=""
```

This rule applies identically to both HotelCard images, DealCard, the deal-detail image, and LockedDealCard. Never use `alt={hotel.name}`, `alt="Hotel photo"`, a room description, or generated visual description.

Rationale: the provider data does not establish what is pictured. Naming the hotel in alt text asserts an identity the app cannot verify. A bare decorative alt is made complete—not left bare—by a visible text caption immediately attached to the image. The caption is ordinary accessible text, not `aria-hidden`, so sighted and screen-reader users receive the same supported fact: photo scope, not photo content.

Do not add `aria-label` to the image or figure. Do not repeat `Property photo` in alt text. For a linked DealCard, keep the link's task-oriented accessible name (`View deal: {hotelName}`); the caption remains visible content, while the decorative image contributes nothing to the link name.

### D2 — one visible scope label

Final copy: **`Property photo`**

- Render it for every successfully loaded image.
- Put it in a caption strip directly below the image inside the same rounded media container. It must not float next to the price, appear as a rate footnote, or overlay an unknown part of the image.
- Use `<figure>` plus `<figcaption>Property photo</figcaption>`, or equivalent semantic grouping. The caption must remain in the accessibility tree.
- Do not append `representative`, `may differ`, or `not your room`. `Property photo` is the smallest factual, non-alarming statement the data supports and clearly does not claim room or rate scope.
- Never render the scope label when no image is available; the missing-state copy replaces it.

Caption pattern:

```tsx
<figure className="overflow-hidden rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-muted)]">
  {/* image or image-loading region */}
  <figcaption className="border-t border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-caption font-medium leading-4 text-[color:var(--text-2)]">
    Property photo
  </figcaption>
</figure>
```

Use `rounded-[var(--radius-card)]` instead of `rounded-[var(--radius-control)]` for large detail media. The caption uses only existing tokens: `--border`, `--bg-surface`, and `--text-2`.

### D3 — one honest missing-photo state

Final copy: **`Photo unavailable`**

Use the same neutral text treatment wherever the relevant surface would otherwise render a photo. Remove the teal gradient and building icon from DealCard, deal detail, and LockedDealCard.

```tsx
<div className="flex min-h-full w-full items-center justify-center rounded-[inherit] border border-[color:var(--border)] bg-[color:var(--bg-muted)] px-4 text-center">
  <p className="text-caption font-medium leading-5 text-[color:var(--text-3)]">
    Photo unavailable
  </p>
</div>
```

- Initial absence is ordinary visible text; no `role` is required.
- If an image URL fails after render, replace the image and `Property photo` caption with this state and announce the change using `role="status"` on the newly rendered fallback.
- Never retain a broken-image icon, caption, gradient, building illustration, emoji, or blurred fabricated placeholder.
- Do not make the state interactive.

### D4 — photo is tertiary; deal claims leave the image

Information hierarchy on all surfaces:

1. Primary: current nightly rate or its honest unavailable state; the Deal Score/verdict where that surface already provides one; primary booking/review action.
2. Secondary: hotel identity, stay/location context, discount versus the usual rate, price-check context.
3. Tertiary: property photo and its scope label, or `Photo unavailable`.

This ticket does not add Deal Score to a surface that lacks it. It prevents photo prominence from outranking the existing rate and Deal Score.

No deal claim may overlay the image. Move all of these outside the media container:

- `DealChip` / discount percentage
- `checked {time}`
- `found {time}`
- `Members`
- `Example`

Use explicit price/deal nouns when moving recency copy so it cannot imply image freshness:

- `Price checked {time}`
- `Deal found {time}`
- `Deal found today`

Discount chip final copy: **`−{discountPct}% vs usual`**. Place it adjacent to the price comparison, never inside the figure. If `discountPct <= 0`, omit it as today.

### D5 — no freshness or verification claim

Never show `verified photo`, `recent photo`, `current photo`, `photo checked`, a capture date, provider attribution for the image, or any equivalent claim. Existing `Price checked…`, `Deal found…`, stale-price warnings, and provider-rate copy remain allowed only when visually and semantically outside the figure.

## Shared presentational contract

UI may extract a shared client-side `PropertyPhoto` component to keep all surfaces consistent. This is preferred because a browser image failure must switch to the same fallback everywhere without changing provider or API logic.

```ts
type PropertyPhotoProps = {
  src?: string | null;
  size: 'thumbnail' | 'card' | 'detail';
  loading?: 'eager' | 'lazy';
};
```

The component owns only image presentation state: `loading`, `loaded`, and `failed`. It must not derive captions, inspect pixels, fetch another URL, or mutate the data contract.

## Responsive surface specifications

### 1. HotelCard — collapsed

#### Default with photo

Keep the thumbnail compact; do not turn the result card into an image-led card.

- 375px: retain the current three-column summary structure, but make the first media column `w-20` so `Property photo` fits without clipping. Image viewport is `h-16 w-20`; caption sits below it. Use `grid-cols-[5rem_minmax(0,1fr)_minmax(6.75rem,auto)] gap-2`. If the containing card is narrower than 351px, switch to `grid-cols-[5rem_minmax(0,1fr)]`; place the rate at `col-span-2` in a top-aligned row before the score/action row rather than compressing the hotel name below two readable lines.
- Desktop from `sm`: use `grid-cols-[5rem_minmax(0,1fr)_minmax(6.75rem,auto)] gap-3`; retain the 80 × 64 image viewport plus caption.
- Use `object-cover`; never stretch the image.
- The image/caption block must not overlap hotel name, quality chips, location, rate, score, CTA, or Details button.
- Keep the rate typography and ScoreChip treatment unchanged. The small image, neutral border, and `text-caption` label make it tertiary.
- DOM/accessibility order should keep the hotel identity, price, ScoreChip, and actions as the meaningful content. Because the image has `alt=""`, it adds no misleading announcement before price evidence.

#### Missing photo

- Use the same 80px-wide figure footprint and minimum height as the loaded image plus caption so the card does not reflow.
- Render only `Photo unavailable`, centered in `bg-[color:var(--bg-muted)]`; do not render `Property photo` too.

#### Loading and image error

- While the image request is pending, reserve the final dimensions. Use `skeleton bg-[color:var(--bg-muted)]` in the image viewport, with the static `Property photo` caption below it. Set `aria-busy="true"` on the figure; the skeleton is `aria-hidden="true"`.
- On load, remove `skeleton` without movement.
- On error, replace the whole figure contents with the dimensionally identical `Photo unavailable` state and `role="status"`. Do not retry automatically.

#### Interaction and focus

- The photo, caption, and fallback have no tap, hover, zoom, or keyboard behavior.
- Existing `Review hotel` and `Details` behavior and focus order remain unchanged.
- At 200% zoom and 375px CSS width, `Property photo` may wrap to two lines but may not truncate or overlap.

### 2. HotelCard — expanded

#### Default with photo

The expanded panel currently places the photo before the Deal Score. Reverse that evidence order:

1. `DealScorePanel`
2. existing quality, location, and price-scope evidence
3. property figure

The photo is the final supporting block, not the opening proof of the deal.

- 375px: image viewport `h-40 w-full`; caption below; container `rounded-[var(--radius-card)]`.
- Desktop: keep `h-40`; do not enlarge beyond the existing size.
- Use the same `Property photo` caption and `alt=""` rule.

#### Missing photo

The collapsed `Photo unavailable` tile remains visible when details open. Do not add a second large empty hero in the expanded panel; omit the expanded media block. This is the same honest state, not silent absence, because the persistent collapsed tile already communicates it. If the expanded image fails after opening, switch the collapsed tile to `Photo unavailable` and remove the expanded figure so the phrase is not duplicated.

#### Loading and error

- Reserve `h-40` plus caption height while an existing URL loads to prevent layout shift.
- Use the same loading and failed behavior as the shared contract. A failed expanded image must not leave a large blank block.

#### Keyboard and mobile

- Opening Details with Enter or Space continues to set `aria-expanded=true` and expose `aria-controls` content.
- Do not move focus to the photo. Focus stays on the Details button; the newly revealed content follows in reading order.
- At 375px, the full figure stays within the existing `px-3`; at desktop it stays within `sm:px-5`.

### 3. DealCard

#### Default with photo

Change the internal scan order so price evidence precedes imagery:

1. hotel name, city, class, and check-in window
2. rate, usual-rate comparison, DealChip, and any savings line
3. property figure
4. provider comparison and trust line

This preserves the card link contract while preventing a 160px photo from acting as the deal headline.

- Move `DealChip` into the price block directly after the usual-price comparison. Its visible copy is `−{discountPct}% vs usual`.
- Move `Example` to the hotel-meta block.
- Move `checked {time}` out of the figure and render `Price checked {time}` below the price/savings line. Preserve its existing `title={updatedAt}` only as supplemental exact-price timing.
- Remove the image depth gradient; it is no longer needed to support overlaid chips.
- 375px: image viewport `h-28 w-full`; caption below; body uses existing `px-4`; price row wraps with `flex-wrap` and no horizontal clipping.
- Desktop card grids: image viewport `h-32 w-full`. Do not restore `h-[160px]` or move the image above price.
- The whole card may remain a link. The caption is not a nested interactive element.

#### Missing photo

- Render `Photo unavailable` in the same `h-28` mobile / `h-32` desktop media footprint.
- Remove the gradient, building SVG, and `aria-hidden` wrapper.
- Keep the missing state after the price block, matching the loaded-photo order.

#### Loading, error, hover, and focus

- Reserve final media height and caption height during load.
- On error, switch to `Photo unavailable` with no card reflow.
- Existing card hover/focus behavior applies to the link/card, not to the photo. The image must not scale or suggest an independent gallery action.
- The link accessible name remains `View deal: {hotelName}`. Enter activates the existing deal link; there is no image-specific keyboard target.

### 4. `deals/[dealId]` detail

#### Default with photo

The page must no longer open with an image as its largest claim. Use this order:

1. hotel title and stay metadata
2. current nightly rate, usual-rate comparison, savings/discount, and explicit price-check context
3. Deal Score section
4. property figure
5. provider handoff action
6. price history and remaining supporting sections

To achieve this order, move `DealScoreSection` ahead of the figure and move the existing provider action directly after the figure. Do not add or change Deal Score calculation.

- Move `DealChip` into the price section beside the comparison. Final copy: `−{discountPct}% vs usual`.
- Move `found {foundAgo}` to the title/meta block as `Deal found {foundAgo}`.
- Keep `Price checked {checkedAgo}` and stale price copy in the price section. Nothing time-related remains inside the figure.
- Remove the teal depth overlay.
- 375px: image viewport `h-[200px]`; desktop at `min-[680px]`: `h-[280px]`, not 320px. Caption is below the viewport inside the same `rounded-[var(--radius-card)]` container.
- Use `decoding="async"`; do not make the hero a link or button.

#### Missing photo

- Keep the same 200px / 280px reserved media region and render centered `Photo unavailable` in the neutral muted treatment.
- No building icon, brand gradient, or `aria-hidden` on the missing copy.

#### Loading and image error

- The route-level `loading.tsx` may use an unlabeled skeleton because it represents the page, not a known photo. Once deal data exists and a photo URL is present, use the shared photo loading state with `Property photo` caption.
- On browser load failure, replace the full figure with `Photo unavailable` and announce once with `role="status"`.
- An unavailable image never blocks title, price, Deal Score, or provider actions.

#### Expired, stale, and provider-error combinations

- Expired deal: photo rules do not change. `Expired {date}` and the `Deal expired` recovery remain outside the figure.
- Stale price: retain `Price may be out of date` and `Price checked…`; do not alter the photo label.
- Missing provider link: retain `Provider link unavailable`; do not remove a valid property photo or imply that photo availability validates booking availability.
- Deal Score loading/unavailable: use the existing score state. The photo remains tertiary and never fills the evidence gap.

### 5. LockedDealCard

#### Default with photo

The locked surface must not use the photo as proof of a deal whose rate is hidden.

Order:

1. visible access context row: `Members` and `Deal found today`
2. property figure
3. existing blurred preview
4. existing unlock overlay and CTA

- Move both top chips out of the image and into a body row above the figure.
- Use the shared `Property photo` caption with `alt=""`.
- 375px and desktop: use `h-28 w-full` for the image viewport. A locked card does not need a 160px hero.
- Keep the unlock overlay out of the figure. It may continue to cover only the blurred body preview.

Final existing access copy remains:

- `Members`
- `Deal found today` (replaces `found today`)
- `Members-only deal`
- `Unlock with Premium`

#### Missing, loading, and error

- Use `Photo unavailable` in the same media footprint; no branded gradient or building icon.
- Loading and failed behavior follows the shared contract.
- Absence of a photo does not change or disable `Unlock with Premium`.

#### Accessibility

- Only `Unlock with Premium` is a photo-adjacent keyboard target. Preserve its minimum current control size and global focus outline.
- The blurred preview remains `aria-hidden`; `Property photo` or `Photo unavailable`, membership context, and CTA remain exposed.

## Final copy inventory

These are all new or changed visible strings in this ticket:

| State or purpose | Final visible copy |
|---|---|
| Successful photo scope | `Property photo` |
| Missing or failed photo | `Photo unavailable` |
| Discount claim | `−{discountPct}% vs usual` |
| Price recency | `Price checked {time}` |
| Deal discovery recency | `Deal found {time}` |
| Locked-card discovery recency | `Deal found today` |
| Locked access tier | `Members` |
| Locked explanation | `Members-only deal` |
| Locked CTA | `Unlock with Premium` |
| Mock card marker | `Example` |

All untouched rate, Deal Score, provider, error, expired, and booking copy remains exactly as implemented. Do not introduce any visible `room photo`, `your room`, `representative room`, `verified`, `recent`, or `current photo` string.

## State matrix

| State | HotelCard collapsed | HotelCard expanded | DealCard | Deal detail | LockedDealCard |
|---|---|---|---|---|---|
| Valid URL, loading | Reserved thumbnail + skeleton + `Property photo` | Reserved hero + skeleton + `Property photo` | Reserved supporting media + skeleton + `Property photo` | Reserved figure + skeleton + `Property photo` | Reserved media + skeleton + `Property photo` |
| Loaded | Decorative image + `Property photo` | Decorative image after evidence + `Property photo` | Decorative image after price + `Property photo` | Decorative image after score + `Property photo` | Decorative image below access row + `Property photo` |
| Missing URL | `Photo unavailable` | No duplicate hero; persistent collapsed state remains | `Photo unavailable` | `Photo unavailable` | `Photo unavailable` |
| Browser error | `Photo unavailable`, announced once | Remove failed hero; collapsed state updates | `Photo unavailable`, announced once | `Photo unavailable`, announced once | `Photo unavailable`, announced once |
| Narrow/long content | Caption wraps, never truncates | Full width | Price wraps before media | Full width | Access row wraps above media |
| Score unavailable | Existing score copy; photo unchanged | Existing score panel; photo stays last | No score added | Existing unavailable score state | No score exposed |
| Price/provider error | Existing honest error leads | Same | Existing behavior; photo proves nothing | Existing error leads | Unlock behavior unchanged |

## Tailwind implementation patterns

Use only tokens already defined in `app/globals.css`:

- Container: `overflow-hidden rounded-[var(--radius-control)] border border-[color:var(--border)] bg-[color:var(--bg-muted)]`; large detail variant uses `rounded-[var(--radius-card)]`.
- Image: `block h-full w-full object-cover`.
- Caption: `border-t border-[color:var(--border)] bg-[color:var(--bg-surface)] px-2 py-1 text-caption font-medium leading-4 text-[color:var(--text-2)]`.
- Missing state: `flex h-full w-full items-center justify-center bg-[color:var(--bg-muted)] px-4 text-center text-caption font-medium leading-5 text-[color:var(--text-3)]`.
- Loading viewport: `skeleton h-full w-full`; add `motion-reduce:animate-none` if the shared `.skeleton` animation does not already respect reduced motion.
- Claim row outside media: `flex min-w-0 flex-wrap items-center gap-2`.

Do not add colors, shadows, gradients, font sizes, or radius tokens. The existing photo gradients must be removed from these surfaces.

## Testing specification

Extend `app/components/__tests__/scorePresentation.test.tsx`; preserve the existing no-photo HotelCard assertion and add helpers only as needed to inspect element props.

### HotelCard assertions

1. Render a hotel with `photoUrl` and assert:
   - visible text contains `Property photo` exactly once while collapsed;
   - the matching `<img>` has `alt === ''`;
   - text does not contain the hotel name as photo alternative copy, `verified photo`, `recent photo`, or `room photo`.
2. Render without `photoUrl` and retain:
   - `Photo unavailable` is visible;
   - `Property photo` is absent;
   - no building SVG/emoji/fake image is present.
3. Expand using the existing mocked `useState` pattern (or isolate the shared presentational component) and assert the expanded photo also uses `alt=""` and `Property photo`; with no URL, assert only one persistent `Photo unavailable` string, not a duplicate large fallback.

### DealCard assertions

Import `DealCard` and render with/without `photoUrl`:

- With photo: `Property photo` is present, image alt is empty, and `−30% vs usual` appears in body text.
- Inspect the figure subtree and assert it contains neither the discount copy nor `Price checked` / `Deal found` / `Example`.
- Without photo: `Photo unavailable` is present, `Property photo` is absent, and no building SVG is rendered.
- For `updatedAt`, assert visible `Price checked {time}` rather than bare `checked {time}`.

### LockedDealCard assertions

Import `LockedDealCard` and assert:

- photo path: empty alt plus visible `Property photo`;
- missing path: visible `Photo unavailable`, no `Property photo`, no building SVG;
- visible context uses `Members`, `Deal found today`, and `Unlock with Premium` outside the figure subtree.

### Deal-detail coverage

`scorePresentation.test.tsx` is a component-level test and should not import the async page with DB/auth dependencies. Extract and test the shared `PropertyPhoto` presentation there, then add or extend the existing deal-detail page test at its natural route/component boundary to assert:

- the photo image uses empty alt;
- `Property photo` or `Photo unavailable` renders according to `photo_url`;
- the figure subtree does not contain the discount or recency copy;
- source order is title → price → Deal Score → figure → provider action;
- no photo freshness/verification strings exist.

At minimum, add a source-level regression assertion only if no route render harness exists; do not mock away `notFound`, auth, database, and Suspense merely to force this test into `scorePresentation.test.tsx`.

### Browser-level acceptance at 375px and 1280px

- No caption, title, price, chip, or CTA overlaps.
- No horizontal scrolling at 375px or 200% zoom.
- `Property photo` is readable without hover and does not rely on contrast over the image.
- Tab order contains no stop for the photo; existing card, Details, booking, and Premium actions retain visible focus.
- Simulate an image 404 and confirm a single `Photo unavailable` announcement and no broken-image artifact.
- Confirm deal/price recency and discount labels are outside each figure at both widths.

## Acceptance criteria

1. All five render contexts use `alt=""`; none uses the hotel name or invented photo description.
2. Every loaded photo has the visible, accessible `Property photo` caption attached to its figure.
3. Every missing/failed photo uses `Photo unavailable`; no affected surface shows a decorative building fallback.
4. Rate and Deal Score precede or visually outrank the photo; DealChip and all deal/price recency copy are outside the image.
5. No image freshness, verification, room, or rate-association claim is introduced.
6. Loaded, loading, missing, failed, mobile, desktop, keyboard, zoom, stale, expired, and provider-error combinations behave as specified.
7. No provider, API, database, money, scoring, booking, or affiliate contract changes are required.

## Out of scope

- Multiple images, carousel controls, lightbox, zoom, swipe, thumbnails, or room galleries.
- Inferring or classifying image content.
- New image source, provider attribution, freshness metadata, or provider/API changes.
- Changing which provider/snapshot image is selected.
- Rewriting rate, Deal Score, hotel rating, location, or booking-handoff contracts.

## UI handoff

Implement this as a UI-only repair. Preserve all public component props and exports. A private shared `PropertyPhoto` component is permitted. Run TypeScript and tests before handing off to TEST; no DEV ticket is required because the existing single-photo data contract is sufficient.
