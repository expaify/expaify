# UXDES: Deal Card Redesign — Design Spec

## Component: DealCard

### New prop additions (backward-compatible)
```ts
firstSeen?: string   // ISO timestamp → "found Xh ago" pill
```

### Image area (h-[160px])
When no photo:
```
bg: linear-gradient(150deg, #0E5A54 0%, #0A4440 100%)
icon: building-skyscraper SVG, 44px, color #9FE1CB, centered
```
When photo:
```
<img> object-cover full bleed
<div> absolute inset-0 bg-gradient-to-t from-[rgba(14,90,84,0.35)] to-transparent (depth overlay)
```

### Chips row (absolute, top-3 left-3 / top-3 right-3)
Discount chip (left):
```
bg #D9A441, color #412402
font: Space Grotesk 700, 15px
padding: 5px 12px, radius 999px
text: −{n}%  (U+2212 en-dash)
```
Time pill (right):
```
bg rgba(20,18,16,0.78), color #FAF7F2
font: Inter 500, 11px
padding: 4px 10px, radius 999px
text: "found {timeAgo}" (e.g. "found 3h ago", "found today")
```

### Card body padding: 16px 18px

### Hotel name
```
font: Space Grotesk 600, 16px, leading-snug, color #141210
margin-bottom: 2px
```

### Meta line
```
font: Inter 400, 12px, color #8a857d
format: "★★★★ · {city} · {checkInWindow}"
```
Stars: filled gold star chars (★) repeated {n} times, then empty (☆) to 5.

### Headline (optional)
```
font: Inter 500, 12px, color #0E5A54
shown above hotel name when present
```

### Price row (flex items-baseline gap-2, mt-10px mb-4px)
```
$X         — Space Grotesk 700, 26px, color #0E5A54
/ night    — Inter 400, 11px, color #8a857d, self-end pb-[2px]
usually $Y — Inter 400, 14px, color #8a857d, line-through
```

### Savings line (shown when savings ≥ $20/night)
```
"Save $Z/night" — Inter 500, 12px, color #0E5A54
```

### OTA section (mt-12px)
Label:
```
"Compare and book on:" — Inter 400, 11px, color #8a857d, mb-6px
```
Grid:
```
display: grid, grid-cols-4, gap-[6px]
each cell:
  - tag: <a> with target="_blank" rel="noopener noreferrer sponsored"
  - border: 0.5px solid #d8d2c6
  - border-radius: 10px
  - padding: 8px 4px
  - text-align: center
  - font: Inter 500, 11px, color #141210
  - hover: border-color #0E5A54, bg rgba(14,90,84,0.04)
  - transition: border-color 100ms, background 100ms
labels: Expedia / Booking / Kiwi / Trip.com
```

### Trust line (mt-10px)
```
"Based on {n} price checks over 60 days · expaify never adds fees"
font: Inter 400, 10.5px, color #8a857d
```

### Card wrapper
```
border-radius: 24px
background: white
border: 0.5px solid #e8e2d8
overflow: hidden
transition: transform 150ms, box-shadow 150ms
hover: translateY(-4px), box-shadow: 0 8px 32px rgba(20,18,16,0.12)
```

## Unchanged components
- `DealChip` — update en-dash and size only
- `StarRow` — not used in new design (stars inline as text chars)
- `LandingNav` — no change
- `LockedDealCard` — no structural change, but image area gets same teal gradient treatment
- `CompareRow` — replaced inline in DealCard; keep file for backward compat but update to 4-col grid

## page.tsx hero deal data
Add `firstSeen: new Date(Date.now() - 3 * 3600 * 1000).toISOString()` to HERO_DEAL and dark band deal.
