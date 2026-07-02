# UXD: Deal Card Redesign — Discovery

## Pain point
The current DealCard uses an ivory aspect-ratio image box that looks like a placeholder bug, not a design decision. The OTA compare row is a flex-wrap of pill buttons that breaks awkwardly at narrow widths. Price display buries "usually $X" after the deal price with no verbal framing. Together these make the card look unfinished compared to the reference mockup.

## Affected surfaces
Hero section (front card), dark band section, live teaser grid, /deals feed — everywhere DealCard is rendered.

## Measurable signal
- Image area: ivory blank box with no visual anchor — looks like a broken image
- OTA row: wraps to 2+2 or 1+1+2 at card widths below 360px
- Price: "usually" prefix missing — strikethrough alone is ambiguous
- Discount chip uses hyphen-minus (-) not mathematical minus (−) — typographic error

## Constraints
1. Brand tokens must not change — ivory, teal, coral, gold are fixed
2. DealCard is a server component — no client hooks
3. Must keep all existing props backward-compatible
4. photo fallback must look intentional, not broken

## Success statement
Solved when a first-time visitor sees the hero DealCard and reads it as a polished product — not a wireframe. The price, discount, and OTA links should be immediately scannable without explanation.
