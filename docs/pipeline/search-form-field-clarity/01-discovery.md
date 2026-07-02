# UX Discovery: Search Form Field Clarity

Ticket: UXD-SEARCH-FORM-FIELD-CLARITY-01  
Surface: Desktop search form  
Affected files reviewed:
- `app/page.tsx`
- `app/components/AirportInput.tsx`

## Pain Point

First-time users cannot quickly tell what each primary search field represents because the origin, destination, departure, and return labels are visually hidden while the visible field text is generic or absent.

## Who Is Affected And When

This affects first-time paid-intent users on the desktop search form before they run their first search. The confusion occurs while filling the route and date fields, especially when scanning the form horizontally: the origin field only says "City or airport code", the destination field says "Anywhere", and the native date inputs show no persistent visible field names for "Depart" or "Return".

## Measurable Signal

The current implementation uses `sr-only` labels for the route and date fields in `app/page.tsx`, and `AirportInput` renders only placeholder text as visible guidance in `app/components/AirportInput.tsx`. A visual audit can confirm that, at desktop width, the four core fields do not have persistent visible labels before input:

- Origin: accessible label exists as `From`, visible placeholder is `City or airport code`.
- Destination: accessible label exists as `To`, visible placeholder is `Anywhere`.
- Departure date: accessible label exists as `Depart`, no visible label or placeholder.
- Return date: accessible label exists as `Return`, no visible label or placeholder.

Expected downstream validation signal: at 1280px desktop, each core field has a persistent visible label that remains clear before and after input without relying on placeholder-only instructions.

## Constraints

1. Accessibility must be preserved: existing programmatic labels, combobox semantics, keyboard behavior, status announcements, error announcements, and focus states cannot regress.
2. The search form must remain compact and usable at 375px mobile and 1280px desktop without overlapping text, clipped labels, or increased form height that pushes the primary search action out of reach.
3. The solution must use the existing design system and Tailwind patterns in the app; it must not introduce new colors, decorative UI, provider/API changes, or business logic changes.

## Success Statement

This is solved when a first-time desktop user can identify From, To, Depart, and Return before typing or selecting dates without relying on screen-reader-only labels, guessing from placeholder text, or submitting the form to discover what a field meant.

