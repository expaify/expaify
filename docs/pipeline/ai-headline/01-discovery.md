---
id: UXD-AI-HEADLINE-01
stage: UXD
---

# Discovery: AI Deal Headline Copywriter

## Problem Statement
Deal cards currently show raw hotel names and numeric discounts. Users scanning the feed must mentally translate "Marriott Miami — 38%" into a reason to care. Without persuasive, human-readable copy, deal urgency is invisible and click-through suffers.

## Who Is Affected
Free and premium users viewing the `/deals` feed, particularly first-time visitors evaluating whether expaify delivers real value before upgrading.

## Measurable Signal
- `headline` column in `deals` table is NULL on all non-mock rows
- DealCard renders hotel name + city as a plain label with no deal hook
- No copy differentiates a 38% Marriott deal from a 32% Hilton deal beyond the number

## Constraints
1. Must not block the pipeline — headline generation runs async after deal detection
2. Headline must fit one line at 16px on 320px mobile (≤60 chars)
3. Must never hallucinate data — use only confirmed deal fields (hotel_name, city, discount_pct, deal_price_cents, median_price_cents)

## Success Statement
This is solved when a first-time user can scan 6 deal cards and immediately understand the specific money-saving opportunity each represents, without needing to read the numeric discount percentage.
