# UI-deals-detail-chart-tooltips

Implemented the scope supplied directly in the ticket: an HTML point-control layer over PriceSparkline's unchanged decorative SVG, preserving its screen-reader trend summary. Hover or keyboard focus shows the existing date/price formatting. Escape dismisses even when keyboard focus is elsewhere. No transition is used, including with reduced motion. Photo components are untouched.

Validation: TypeScript and the full Jest suite exit 0 (170 suites passed, 1823 tests passed, 7 skipped). Jest reports a worker shutdown warning. Interaction tests cover pointer entry/exit, every keyboard point, focus persistence, and Escape. Independent review identified hover-only Escape dismissal; this was fixed and covered.

Browser checks at 375px and 1280px remain for QA. Creating TEST-deals-detail-chart-tooltips-01 via the board API failed because localhost:3001 refused the connection. This document preserves the handoff; QA is not marked done.
