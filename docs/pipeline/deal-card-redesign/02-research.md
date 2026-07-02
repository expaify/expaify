# UXR: Deal Card Redesign — Research

## Reference: the mockup
- Image area: h-130px, solid teal #0E5A54 bg, centered building-skyscraper icon in primary-soft
- Chip: gold bg, Space Grotesk 700 15px, **en-dash** `−54%`
- "found 3h ago": dark pill top-right — relative time is a trust signal
- Hotel name: Space Grotesk 500 16px (not heavy bold)
- Meta line: `★★★★ · Lisbon, Portugal · Mar 12–14` — single line, dots
- Price row: `$189` (teal 26px 700) + `/ night` (11px gray) + `usually $410` (strikethrough 14px gray) — "usually" prefix adds clarity
- Compare label: 11px gray "Compare and book on:"
- OTA grid: 4 equal columns, each a bordered cell — NOT flex row
- Trust: 10.5px gray, mentions 60 days + "never adds fees"

## Benchmark: Booking.com
- Photo always present; fallback is a standard placeholder with category icon
- Price typography: deal price large + strikethrough normal + "per night" label
- OTA links not applicable (single-platform)

## Benchmark: Google Hotels
- Card image fills width
- Price: "$X / night" inline, original price as small strikethrough
- Deal badge: green "X% off tonight" chip

## Gap analysis
| Dimension | Current | Mockup + improvement target |
|---|---|---|
| Image area | Ivory ratio box (broken-looking) | Teal gradient bg + icon (intentional) |
| Photo | No fallback icon | Building icon on teal |
| Chip | `−47%` hyphen | `−47%` en-dash, 15px |
| Time | "Found" (static) | "found 3h ago" relative |
| Hotel name | Space Grotesk 700 20px | Space Grotesk 600 16px |
| Price layout | Price / night + strikethrough below | Price + /night + "usually $X" inline |
| Savings | Not shown | "Save $X/night" secondary badge |
| OTA row | Flex-wrap pill buttons | 4-col bordered grid, hover teal border |
| OTA labels | "Booking.com" | "Booking" (space) |

## Design directives
1. Teal gradient image bg (#0E5A54 → #0A4440) with building SVG centered in primary-soft when no photo
2. Photo if present: object-cover + bottom gradient overlay (teal 0% → transparent) for depth
3. Chip: `−{n}%` with `−` (U+2212), font-display 700, 15px, gold
4. "found Xh ago" pill: computed server-side from `firstSeen` prop
5. Price inline: `$X` teal 26px → `/night` 11px gray → `usually $Y` strikethrough 14px gray
6. Savings line below price: "Save $Z/night" in teal text, 12px, only when savings > $20
7. OTA: 4-col grid, 6px gap, each cell border-0.5px #d8d2c6, radius 10px, hover → border teal, bg tint
8. Card hover: -translate-y-1, shadow `0 8px 32px rgba(20,18,16,0.12)`
