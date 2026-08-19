# Eng handoff: Deal detail page IA (omit empty evidence, proof-first)
(Verbatim/condensed from Helena, expaify's marketing/design lead, dated 2026-08-19, following a real live-site crawl. Trigger doc: a direct owner report of a real deal page screenshot description, root-caused independently by both Helena's crawl and the orchestrator's code read.)

**Status:** Ready for eng, pulled forward by owner on 2026-08-19.
**Surface:** `/deals/[id]` only (not homepage, not the `/deals` grid — that's P9.2, separate).
**Live reference:** Interno 2 alle Mura, Rome — `https://expaify.com/deals/75b323a8-1fa8-4506-8e5c-b596d1dca313`
**Parent product law (unchanged):** never invent hotel facts · free path + unlock economy unchanged · book on OTA · 30%+ / 60-day median / ≥8 checks

## 0. Goal
Turn the deal detail page from a liability dossier full of "not provided" sections into a decide-and-book page: prove the drop, hand off to the OTA, then show real context (history, photo, reviews if any, day plan).
North star job-to-be-done: "Is this rate actually cheap vs history, and can I book it on a real OTA in one click?"
Ethos (keep): never fabricate amenities, climate, EV, quiet, renovation, or accessibility outcomes.
Expression (change): absence = omit the block entirely, not an eight-headed essay saying "Unknown / not provided / no check was attempted."

## 1. Problem, live evidence (2026-08-19)
On a real unlocked deal, current page order top to bottom: Header (OK) -> Price + Deal Score (real numbers, but disagrees with the feed's numbers for the SAME deal, see §3 -- ROOT CAUSE FOUND, see orchestrator note) -> Cancellation "unavailable" essay (noise) -> "Hotel fit" 7+ sub-blocks almost all empty (scroll killer) -> "Check rooms"/accessibility repeat with a dead "provider link unavailable" path (conversion hole) -> flights search (off-job, wrong page) -> Supporting evidence: real photo + neighborhood (good, buried too late) -> Price history (real, good, buried too late) -> AI day plan / T3 (real, honest, buried too late) -> Offer details (collapsed, fine).
Root cause: "never claim data we don't have" was implemented as "always render every fact category, with an explanation of why it's empty." Industry hotel-data APIs do not reliably supply structured EV cost, room thermostat, quiet-room, etc. -- more pipeline will not fill those slots. This is primarily a display/IA fix, plus one real P0 data-consistency bug (§3) and OTA link reliability (§4).

## 2. Scope
**In:** (1) single price truth on detail vs feed/list/card, (2) primary OTA CTA when a link exists, honest dead-link state when not, (3) new section order, (4) empty-state law: omit blocks with no data, (5) collapse optional diligence into one accordion only when needed, (6) status chips instead of multi-paragraph unavailable boxes, (7) reviews block only when score/snippets exist, (8) keep T3 day plan + price history, move both up, (9) free-alert secondary CTA (existing intent URLs + UTMs, unchanged), (10) feature flag `deal_detail_ia` + rollback, (11) mobile layout, never a dual primary CTA.
**Out:** full `/deals` grid/filter redesign (P9.2), homepage changes, auth/unlock economy/Premium price, inventing amenities via AI, multi-day itinerary expansion, a flights product build, new paid API contracts beyond wiring review/photo fields already available, changing the 30%/60-day/8-check rules themselves (only their consistent display).

## 3. P0 — One price truth (must ship with the IA)

**Bug observed live, same deal, same day:**
| Surface | "Usual" / window | % / checks |
|---|---|---|
| Homepage / feed card | $248.63, 60-day · 9 checks | −59% vs usual |
| Detail page Deal Score block | $144.48, 90-day · 18 checks | "30% below" / Great |

Visitors read this as broken math, not "two valid windows."

**ORCHESTRATOR ROOT-CAUSE NOTE (verified by reading the actual code, not guessed):**
- The "90 days" label is a **hardcoded string bug**, not a real computation window: `app/components/DealScorePanel.tsx` around lines 60-65 has `'Last 90 days'` and `` `${sampleSize} price checks, last 90 days` `` as literal hardcoded copy, regardless of what window the actual data represents. The real query behind it (`getPriceHistory` in `lib/pipeline/dealDetection.ts`, line ~217) already correctly uses `INTERVAL '60 days'` — so the *window* is actually 60 days already, just mislabeled as 90.
- The real, deeper issue: the detail page (`app/deals/[dealId]/page.tsx`, around lines 273-289) computes its OWN independent median/score via `scoreDeal(offer, pricePoints)`, where `pricePoints` comes from `getPriceHistory()` — a query that returns **one averaged price per calendar day** (`AVG(price_cents)::INT ... GROUP BY snapshot_date`). `scoreDeal()` then derives its own median from that day-averaged series.
- Meanwhile, the feed/list (`getActiveDeals` / `getDealById` in `lib/pipeline/dealDetection.ts`) already computes and stores canonical `median_price_cents`, `discount_pct`, and `snapshot_count` directly on the `deals` table row (via the deal-detection SQL, a true median/count over raw snapshots, not day-averaged) — these are the numbers already shown on every deal card everywhere else.
- **These are two separate, independently-computed implementations of "the same number."** That's why they diverge (median-of-daily-averages vs. true median-of-raw-snapshots, and "distinct days with data" vs. "raw snapshot count" produce different counts too).

**Product rule (canonical, applies everywhere a visitor sees this deal):** Use the SAME deal economics fields — `median_price_cents` (labelled "usual"), `discount_pct` (labelled "% off"), `snapshot_count` (labelled "checks") — that `getDealById()`/`getActiveDeals()` already return on the `DealRow`, on the detail page, the feed card, AND the price-history chart. Do not let `DealScorePanel`/`scoreDeal()` compute an independent second median for display purposes.

**Eng requirements:**
- The detail page's price-proof card must read `deal.median_price_cents` / `deal.discount_pct` / `deal.snapshot_count` (the same `DealRow` fields already fetched by `getDealById` for this page) rather than deriving new numbers from `scoreDeal()`.
- `scoreDeal()`/`DealScorePanel` can still be used for its qualitative verdict (Great/Good/Typical) if that logic is otherwise sound, but its *displayed* median/window/count copy must either be removed in favor of the canonical fields, or be fed the canonical values instead of independently recomputing them. Simplest correct fix: pass the canonical `median_price_cents`/`snapshot_count`/a real "60 days" window label into whatever renders the price-proof card, and stop `DealScorePanel` from independently deriving a competing median in the first place, OR fix `DealScorePanel`'s hardcoded "90 days" copy to read the real window it's actually given AND ensure that window and count are the canonical ones (pick whichever approach requires the smaller, safer diff — orchestrator recommends: feed the canonical values in rather than rewriting the scoring internals, since `scoreDeal` is a shared generic function also used for flights per its type overloads, changing its internals is riskier than changing what data reaches the detail page's price-proof display).
- Chart "usual" series and any callout must match the primary usual value shown in the price-proof card.
- QA: pick 5 live deals, assert feed card vs. detail page equality for now/usual/pct/checks/window on each.

## 4. P0 — OTA handoff
When a real provider URL exists: one solid primary button, "View deal on {Provider}" (e.g. Booking.com), opens the provider, expaify never takes payment. Secondary text link: "Get free alerts for {City}" using the EXACT existing free-path URL pattern already used elsewhere in this codebase (`/login?intent=free&city=...&utm_source=deal_detail&utm_medium=secondary&utm_campaign=free_alerts` — verify the exact existing pattern in `LockedDealCard.tsx`/`HomepageRedesign.tsx` rather than inventing a new one).
When the provider link is missing/invalid: do NOT show a fake "Check rooms" primary that goes nowhere. Show one honest banner: "Booking link unavailable for this snapshot" + one sentence ("compare current rates on your usual OTA, or go back to results") + two actions ("Back to matching hotels" · "Get free alerts for {City}"). Kill the long "Check rooms with provider" section that currently repeats the accessibility notice + "room availability not checked" + a dead button when the link is missing — merge any real room-check deep link into the primary CTA only, nothing else.

## 5. Target IA (implement in exactly this order on the detail page)
1. Chrome: "Back to results" (preserve existing query params as today).
2. Hero (above the fold): large real property photo, hotel name (H1), city link + star class if present + dates + nights, one short honesty line if only an area (not street address) is known — keep whatever this codebase's current copy for that already is. Price-proof card: now · usual (strikethrough) · % off · 60-day median window (correct, real) · N checks · checked {relative time} · Deal Score verdict chip (Great/Good/Typical) — all from the canonical `DealRow` fields per §3. Primary CTA: "View deal on {OTA}" or the missing-link banner per §4. Secondary: "Get free alerts for {city}". A compact status-chip row (§7), not full paragraph boxes. Nothing about EV, climate, sustainability, or flights belongs in the hero.
3. Price history (existing chart component, keep, move up under the hero) — same usual/now numbers as the hero, one plain-language summary line, footer note "Based on {N} checks over 60 days".
4. Place context: existing neighborhood tag + short paragraph (keep current copy), optional real POI links if already generated — no fake distances.
5. Guest reviews — CONDITIONAL: render only if a rating and/or review count and/or at least one real review snippet exists for this hotel (this is exactly `HotelReviewEvidence` from the T1 TripAdvisor work earlier this session — reuse `GuestReviewEvidence`/`getGuestReviewScanLine` from `app/components/GuestReviewEvidence.tsx` and `app/components/ui/DealCard.tsx` rather than building a new review UI). If no evidence exists, omit the entire section — do not render "Guest score not provided by this provider" as a visible block on this page (note: that state copy is correct and fine to keep on OTHER surfaces like the booking flow per T1's existing design, just don't surface it prominently on this specific page when there's nothing to show).
6. AI-suggested day plan (T3, `AiDayPlanSection`) — keep exactly as-is, already honest (single day, not a fantasy multi-day itinerary), just move up in the page order.
7. "Stay notes" accordion — CONDITIONAL, collapsed by default: render only if at least one real field has actual data (true/false/a real string from the provider), or the user carried real accessibility/EV/quiet needs into this specific deal. Rows inside show ONLY populated fields — never a row whose value is "Not provided by this provider" / "Unknown" / "No check was attempted". If nothing qualifies, don't render the accordion at all (not even collapsed-empty).
8. "Offer details" — keep exactly as today, collapsed.
9. Footer/tertiary: move the flights search out of its current position (currently sits between "check rooms" and "supporting evidence", i.e. mid-page) — either remove it from v1 of this page entirely, or reduce it to a single text link in the footer area ("Search flights to {city}"). It must never sit between the price-proof/CTA area and the price history section. Chat widget must never cover the primary CTA (verify z-index, same requirement as P9.1's homepage chat rule).

## 6. Empty-state law (non-negotiable, this is the actual fix)
**Rule:** for each optional fact block (hotel class, guest review, room climate x3, EV charging x8 fields, renovation/closures, accessibility fit, quiet-stay, sustainability credential): `if hasDisplayableData(block): render it. else: do not mount the block at all` — no heading, no "not provided" body text, nothing in the DOM for that block.

**Blocks to delete from the always-on page entirely** (only ever show inside the conditional Stay Notes accordion from §5.7, and only when populated):
- Hotel class "not provided" as its own section -> omit; show class only when known (e.g. inline near the title if real).
- Guest review evidence empty state -> omit whole section (see §5.5, review UI is conditional).
- Room climate (cooling/heating/room-temp) x3, all showing "not supported by this provider connection" -> omit entirely unless any field is actually confirmed.
- EV charging "Unknown" header + 8 "Not provided by this provider" fields -> omit the entire module unless at least one field is genuinely confirmed by the provider.
- Renovation/closures "not provided" essay -> omit.
- Accessibility fit essay when no needs were selected by the user -> omit; if the user DID select accessibility needs for this search, show one compact outcome line only ("needs list + fit outcome + 'Confirm on booking site'"), not the current essay.
- Quiet-stay "not provided" -> omit.
- Sustainability credential "has not been checked" -> omit.
- Duplicate accessibility notice under "Check rooms" -> omit (merge into the primary CTA area or delete, per §4).
- The multi-sentence "Cancellation choices unavailable" box -> replace with a small status chip (§7), not a paragraph box.

**Copy principle:** one single global footer-style line is enough for residual honesty, if you want it at all, stated once: "Amenity and room details can change. Confirm cancellation, accessibility, and room type on the booking site before you pay." Do not repeat that idea under every individually-missing field. Never expand empty-state copy to sound friendlier or more thorough — shorter absence beats nicer absence.

## 7. Status chips (replace the essay boxes)
Small horizontal-wrap chips under the CTA area, teal/ink styling (not alarmist red, unless the provider link is genuinely dead — that gets the missing-link banner from §4, not a chip). Examples: "Cancellation: check on OTA" (when not in the snapshot) or the real cancellation terms if known (never invented); omit a chip entirely for provider-link-OK (or a subtle "Opens {Provider}" hint if useful); "Deal score: Great" (optional, may live only on the price card instead of a separate chip — pick one, don't duplicate). Max ~3 chips. No chip at all for EV/climate/quiet-stay when unknown — that's the whole point, silence beats a chip that says "unknown."

## 8. Data investments (this part is allowed, and prioritized correctly)
Do NOT chase structured EV-connector/climate-control APIs — confirmed earlier this session, no realistic hotel-data API (RapidAPI or otherwise) reliably returns this for arbitrary properties.
Where a real API upgrade genuinely helps, in priority order:
- P1: Review score + snippets when the provider actually returns them — this is exactly the `HotelReviewEvidence` system already built and wired for TripAdvisor this session (T1). Use it here too (§5.5). Never invent quotes; if Agoda review text becomes licensed/available later that's a future addition, not required now.
- P1: Better/more photos when real URLs already exist (hero gallery, optional 2-3 thumbnails) — do not fetch new images, just use what's already returned by the existing hotel-data providers if more than one photo URL is available.
- P2: POI/neighborhood polish (existing neighborhood copy is fine, don't rebuild).
- Later, not now: user-declared needs (EV/step-free/quiet) as an explicit filter/checklist the user opts into, rather than always-on "evidence theater" for facts nobody asked about. Out of scope for this ticket.

## 9. Components (suggested breakdown, adapt to whatever this codebase's actual existing component boundaries look like — check before inventing new files where an existing one already does most of the job)
DealDetailHero (photo, title, meta, price proof, CTAs, chips), a price-proof display reading the canonical DealRow fields per §3, ProviderHandoff (primary button or missing-link banner per §4), the existing price-history chart component moved up, existing "supporting evidence"/neighborhood block, the existing GuestReviewEvidence/getGuestReviewScanLine wired conditionally, the existing AiDayPlanSection moved up, a new conditional StayNotesAccordion, the existing collapsed offer-details block. Remove or gut whatever the current monolithic "always map the full amenity/evidence schema to UI" component is (this is likely `HotelFitSection`-equivalent or wherever the climate/EV/accessibility/quiet-stay blocks currently live in `app/deals/[dealId]/page.tsx` — check the actual current file for its real name before assuming).

## 10. DO NOT TOUCH
Free path (`intent=free`, city param, existing UTM patterns) · unlock economy (3/week free, Premium unlimited) · the 30%+/60-day/8-check THRESHOLD RULES themselves (only their consistent *display* per §3) · OTA booking (user always pays the provider, never expaify) · AI day-plan honesty (single-day framing, T3) · feed/list locked-card rules (unrelated, stays P9.2 scope) · the P9.1 homepage work (this is a fully independent flag/ticket).

## 11. Acceptance criteria
**P0:** same `dealId`'s feed/list card now/usual/pct/checks/window exactly match the detail hero · zero always-on "Hotel fit" wall, zero "Not provided by this provider" rows visible on a typical deal with no exotic data · zero 8-field EV module on typical deals · a valid provider link produces one clear "View deal on {OTA}" primary · an invalid/missing link produces the honest banner, never a fake check-rooms CTA · price history and AI day plan appear above any optional stay-notes accordion · the free-alerts secondary CTA still uses the exact existing `intent=free` + `utm_campaign=free_alerts` pattern, unchanged · no "Trusted by..."-style invented claims anywhere on this page (should already be absent, verify).
**P1:** guest reviews section absent when there's no data, present and correct when there is · cancellation is a chip or one line, never the current tan essay box, by default · flights link (if kept) is not positioned between the hero and price history · mobile: the primary OTA handoff and free-alerts CTA are reachable without scrolling through any empty modules · tokens stay consistent with the P9.1 token system · flag off restores the exact previous detail page.
**P2:** photo can be larger with optional thumbnails if easy · offer details stays collapsed · add analytics events `deal_detail_view`, `deal_detail_cta_provider`, `deal_detail_cta_free_alerts`, `deal_detail_missing_provider_link` if this codebase already has an established analytics-event pattern to follow (check `lib/analytics` or similar before inventing a new one).

## 12. Feature flag + rollback
Same pattern as P9.1: an env-var-gated flag (e.g. `NEXT_PUBLIC_DEAL_DETAIL_IA`), default OFF, gating the new detail-page IA vs. the current one, so it can be toggled off in one deploy without a code revert. The §3 price-truth fix (using canonical DealRow fields instead of `scoreDeal`'s independent computation) is a real correctness bug fix and should ship un-flagged / always-on regardless of the IA flag, matching how the PropertyPhoto "e" bug fix in P9.1 shipped un-flagged as a pure bug fix — the IA reorder/empty-state-omission is the part that's genuinely a design decision worth flagging.

## 13. Implementation order
1. Fix the price-truth bug (§3) — this alone is worth shipping even before the rest, real correctness fix, no flag needed.
2. ProviderHandoff primary/missing-link states (§4).
3. Unmount (not just hide) the empty Hotel fit / EV / climate / accessibility-essay / quiet-stay / sustainability / renovation blocks per §6.
4. Reorder sections to match §5.
5. Status chips for cancellation (§7).
6. Conditional guest reviews wiring (§5.5, reuse existing T1 components).
7. Demote/remove the flights search from its current mid-page position.
8. Feature flag for the IA reorder + QA on a handful of real live deals (mix of providers/locked states).
9. Mobile pass.

## 14. One-line for eng standup
Deal detail: stop rendering absence as content; one real 60-day price truth shared with the feed (fix `DealScorePanel`'s hardcoded "90 days" + the independent `scoreDeal()` computation); OTA button first or an honest dead-link banner; price history and AI day plan moved up; empty Hotel fit/EV/climate/accessibility/quiet-stay/sustainability sections removed entirely when there's no data.
