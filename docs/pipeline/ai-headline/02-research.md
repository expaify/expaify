---
id: UXR-AI-HEADLINE-01
stage: UXR
---

# Research: AI Deal Headline Copywriter

## Current State
`deals.headline` is NULL for all real deals. DealCard renders `hotel_name` as the primary label. The deal value is communicated only by the DealChip percentage and the price row — both numeric, neither emotionally engaging.

## Reference Patterns
**Google Flights price alerts:** "Prices for LAX → JFK just dropped 34% — $189 round trip"  
Pattern: specific city pair + specific dollar amount + relative language ("just dropped").

**Kayak deal emails:** "Miami from $149 — your cheapest week to go"  
Pattern: destination + concrete price + scarcity framing.

## Design Directives
1. Headline must lead with city or hotel name — the traveler self-selects by destination first
2. Include the saving mechanism: "drops to $X/night" or "X% below usual price"
3. Cap at 60 characters — the card is 340px wide at minimum, and one headline overflow ruins the layout
4. Tone: confident, factual, no superlatives ("amazing", "incredible") — trust erodes with hype
5. Generate from confirmed fields only: `hotel_name`, `city`, `discount_pct`, `deal_price_cents` — never invent amenity claims or date restrictions
