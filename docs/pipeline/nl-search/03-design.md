---
id: UXDES-NL-SEARCH-01
stage: UXDES
---

# Design Spec: Natural Language Deal Search

## Component: SearchBar (client, replaces city dropdown)

### States
- **Default:** Input empty, placeholder "Search deals e.g. 'beach hotels in Miami under $150'"
- **Typing:** Debounced — no request until Enter or button click
- **Parsing:** Button shows spinner "…", input disabled
- **Parsed:** Intent chip appears below input
- **Error / no parse:** Falls back to substring city match — no error shown to user
- **Empty results:** Existing empty state on DealFeed

### Intent chip
Shown when a parse result is active:
- Background `var(--primary-soft)`, text `var(--primary)`, 12px, pill shape
- Text: "City: Miami" or "≤$150/night" or "30%+ off" — only chips with values
- × button clears that filter; clearing all restores default feed

### Layout
- Position: above the existing filter row in DealFeed
- Mobile: full width input + icon button
- Desktop: 600px max-width, centered

## API: POST /api/search/parse
Request: `{ query: string }` (max 200 chars)
Response: `{ city?: string, maxPriceCents?: number, minDiscount?: number }`

Prompt to claude-haiku:
```
Extract travel deal search filters from this query. Output only valid JSON.
Keys allowed: city (string, one of: Miami, New York, Cancún, Paris, Rome, Barcelona, Lisbon, London, Tokyo, Bangkok, Dubai, Las Vegas, Orlando, San Juan, Tulum, Amsterdam, Athens, Punta Cana, Charlotte, Nashville), maxPriceCents (integer, price per night × 100), minDiscount (integer 0-99).
Only include keys present in the query. If city is not in the list, omit it.
Query: "{{query}}"
```

## Tailwind classes
- Input: `w-full rounded-[12px] border border-[color:var(--line-ivory)] bg-white px-4 py-3 text-[14px] text-[color:var(--ink)] outline-none focus:border-[color:var(--primary)] placeholder:text-[color:var(--ink-faint)]`
- Button: `ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[color:var(--primary)] text-white`
- Chip: `inline-flex items-center gap-1 rounded-[999px] bg-[color:var(--primary-soft)] px-3 py-1 text-[12px] font-medium text-[color:var(--primary)]`
