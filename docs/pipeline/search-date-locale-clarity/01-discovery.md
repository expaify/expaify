# UX Discovery: Search Date Locale Clarity

Ticket: UXD-SEARCH-DATE-LOCALE-CLARITY-01  
Surface: Search form date entry and search API date handling  
Affected files reviewed:
- `app/page.tsx`
- `components/search/SearchPanel.tsx`
- `app/api/search/route.ts`
- `lib/types.ts`

## User Pain Point

Paid-intent users can lose confidence before searching because the date fields do not clearly state the expected date format, timezone basis, or whether the return date means flight return or hotel checkout for flight, hotel, and flight + hotel searches.

## Who Is Affected And When

This affects first-time users at the search form step while choosing dates for flights, hotels, or flight + hotel intent. The highest-risk moment is a round-trip or hotel-intent search where the user sees generic `Depart` and `Return` labels, chooses native browser calendar dates, and cannot confirm whether expaify will interpret those dates as local travel dates, UTC-normalized dates, hotel nights, or same-day boundaries before submitting.

## Measurable Signal

The current implementation exposes several observable clarity gaps:

- `app/page.tsx` renders native `type="date"` controls labeled `Depart` and `Return`, with no visible helper copy for date format, timezone basis, hotel check-in/checkout semantics, or night boundaries.
- `components/search/SearchPanel.tsx` renders a second search panel with the same `Depart` and `Return` labels and no visible date-format or stay-boundary explanation, creating the same ambiguity in any surface that uses this component.
- `app/api/search/route.ts` validates query dates strictly as `YYYY-MM-DD`, compares them to `todayIso()` from the server clock, expands flexible dates using UTC midnight, and sends hotel availability as `{ checkin: depart, checkout: ret }`, but this interpretation is not communicated before search.
- `lib/types.ts` models flight ranges as `depart` and optional `return`, while hotel providers receive `checkin` and `checkout`; the shared contract supports distinct meanings, but the UI copy collapses them into one generic `Return` field.

Expected downstream validation signal: at 375px mobile and 1280px desktop, a first-time user can identify the required date format, understand that searches use calendar dates rather than times, and understand that hotel results use the selected return date as checkout without submitting the form or reading an error response.

## Constraints

1. Data integrity must remain strict: dates must continue to submit and validate as `YYYY-MM-DD`, past dates must remain blocked, and one-way searches must not include a return date.
2. Cross-intent clarity must not create false promises: copy must distinguish flight departure/return dates from hotel check-in/checkout boundaries without implying timezone-specific provider guarantees that expaify cannot control.
3. Accessibility and layout must hold at 375px mobile and 1280px desktop: helper text, errors, labels, and focus states must remain readable, programmatically associated where needed, and must not crowd the search form or push the primary search action out of reach.

## Success Statement

This is solved when a first-time user can choose travel dates for a flight, hotel, or flight + hotel search without wondering what date format expaify expects, which timezone or calendar-day basis is being used, or whether the return date will be treated as a hotel checkout date.
