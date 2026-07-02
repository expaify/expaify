# UXD-MOBILE-SEARCH-FORM-CLUTTER-01: Mobile Search Form Clutter

## User Pain Point

On mobile, a paid user must parse too many competing search controls before they can confidently start a flight or hotel search, which makes the primary action feel slower and less trustworthy than it should.

## Who Is Affected And Where

This affects first-time and returning paid mobile users at the search form step, before results. The current form asks users to choose search intent, trip type, origin, destination, swap direction, departure date, return date, flexible dates, and passenger count before the submit button; `app/page.tsx` also places trip inspiration and recent search affordances adjacent to the form, increasing the number of decision paths on the first screen.

## Measurable Signal

The implementation signal is control density in the mobile form: before submit, the default round-trip search path exposes three search-intent buttons, two trip-type buttons, two airport comboboxes, one swap button, two date inputs, one flexible-date checkbox, two passenger stepper buttons, and one submit button. At 375px width these stack vertically, so the user must scan multiple groups and likely scroll before completing or verifying the minimum search path.

Product signals to confirm in QA or analytics:
- Mobile search-start rate is lower than desktop for paid users landing on the form.
- Mobile time-to-submit is elevated for the first search attempt.
- Mobile validation or abandoned form sessions cluster before destination/date completion.

## Constraints

- Preserve search data integrity: origin and destination must still resolve to valid airport selections, dates must remain validated, and hotel search must not run without the required round-trip destination/date context.
- Preserve accessibility: intent controls, trip-type controls, airport comboboxes, date errors, checkbox, passenger stepper, and submit must remain keyboard reachable with clear labels and focus states at 375px.
- Preserve trust and paid-user clarity: the form must keep the distinction between flights, hotels, and flight + hotel clear without making optional controls compete with the minimum path to start a search.

## Success Statement

This is solved when a first-time paid mobile user can start a valid flight or hotel search from the form without having to parse optional controls as required steps or scroll past multiple competing decision groups before the primary submit action is clear.
