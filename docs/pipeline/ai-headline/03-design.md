---
id: UXDES-AI-HEADLINE-01
stage: UXDES
---

# Design Spec: AI Deal Headline Copywriter

## States

### Headline present
- Rendered above the hotel name on DealCard
- Font: 13px, weight 500, color `var(--ink-soft)`, italic
- Single line, overflow ellipsis

### Headline null / loading
- Hotel name shown as primary label (current behaviour — no change)
- No placeholder or skeleton for headline

### Error in generation
- Silent fail — leave headline null, pipeline continues

## Interaction Rules
- Headline is read-only — never editable by user
- Generated once per deal row; re-generated if deal price changes >5% (new pipeline run upsert)

## Copy System
Claude claude-haiku-4-5 generates headlines from a strict prompt:

```
You write short hotel deal headlines for a travel deals app.
Rules:
- Max 60 characters including spaces
- Lead with city or hotel name
- Include "$X/night" using the actual price
- Include discount percentage
- Factual, no hype words
- No punctuation at end

Data: hotel={{hotel_name}}, city={{city}}, price=${{deal_price_dollars}}/night, discount={{discount_pct}}%

Write one headline only.
```

## Pipeline Integration
- `generateHeadlines(deals)` called after `detectDealsForMarket` in `/api/pipeline/run`
- Batches up to 20 deals per Claude API call (one headline per message, but parallel requests)
- Updates `deals.headline = $1 WHERE id = $2` for each result
- Uses `ANTHROPIC_API_KEY` env var
- Times out per-request at 5s; skips on error

## DealCard Display
- Position: between hotel name and price row
- Class: `text-[13px] italic text-[color:var(--ink-soft)] leading-tight truncate`
