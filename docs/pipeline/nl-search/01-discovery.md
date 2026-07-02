---
id: UXD-NL-SEARCH-01
stage: UXD
---

# Discovery: Natural Language Deal Search

## Problem Statement
The deals feed has city and discount filters but forces users to know city names exactly. Users who think "I want a beach deal under $200" have no way to express that and must browse every city manually.

## Who Is Affected
First-time visitors and deal hunters who land on /deals without a specific city in mind — the broadest audience.

## Measurable Signal
- No free-text search input exists on /deals
- City filter is a hardcoded dropdown of 20 city names — requires prior knowledge
- Users who don't find their city abandon the page

## Constraints
1. Must not add latency to the page load — search is triggered on submit only
2. Must degrade gracefully when AI parsing fails: fall back to keyword city match
3. Must not send PII — query string only, no auth context to the AI parser

## Success Statement
This is solved when a user typing "beach hotel in Miami under $150" sees relevant deals within 2 seconds, without needing to select from a dropdown.
