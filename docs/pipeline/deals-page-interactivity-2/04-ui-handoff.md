# UI-deals-page-interactivity-2 — item 4

Implemented the initial feed skeleton-to-results crossfade, including retry skeletons transitioning to results, error, or empty output. Only the skeleton exit is retained; result content is never retained by the new presence boundary. Existing destinationGridKey and all fetch/pagination/coverage logic remain unchanged. Existing load-more card entrance remains handled by the prior ticket.

Uses useDealMotion, its shared easing and 300ms duration, and immediate removal for reduced motion or unknown preference. Departing skeletons are inert and aria-hidden.

Validation: npx tsc --noEmit after JSX edit, npx tsc --noEmit --incremental false, npm test -- --passWithNoTests (170 suites passed, 1820 tests passed, 7 skipped), and npm test -- DealFeed.history (2 passed, test file unchanged) all exited 0. Jest reported a forced worker exit. Added card-set replacement tests with motion enabled and disabled. Independent agent review found no blocking issues.

QA follow-up: visually check 375px and 1280px, initial load/retry to results/error/empty, and reduced motion. These browser checks have not been performed.

Item 3 is deferred pending scope clarification: LockedDealCard success calls window.location.reload(), destroying the mounted tree. An in-place unlock transition requires changing that behavior, beyond the explicit render-only constraint. Item 5 is deferred under the user's requirement that 3–4 land cleanly first.

Board handoff attempted for TEST-deals-page-interactivity-2-04; localhost:3001 refused the connection. Create that QA ticket when the board is available. This file preserves the handoff; QA is not marked done.
