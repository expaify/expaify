# expaify Agent Fleet

Registry of every LLM/agent this pipeline can dispatch to, modeled on
[loop-engineering](https://github.com/cobusgreyling/loop-engineering) (one
loop: schedule → triage → state → worktree → implementer → verifier → gate)
and [fleet-engineering](https://github.com/cobusgreyling/fleet-engineering)
(governing the *population*: registry, economics, sovereign control).

**The accountability test every action here must answer:** which agent did
it, with what authority, against what ticket, verified how.

The live Claude Code session working an expaify ticket is the **orchestrator
("the brain")** — not a fixed pipeline stage. It reads this file, live-checks
whichever agent it's about to hand work to if the `status` below is stale
(>1 session old), dispatches, and updates the `status`/`last_verified`
columns afterward. This replaces AGENTS.md's old "no substitutions" per-stage
model binding: the stage→persona mapping in AGENTS.md still defines *what
job* each stage does, this file decides *which live agent* does it.

## Registry

| Agent | Role | Auth | Cost tier | Status | Last verified |
|---|---|---|---|---|---|
| **Krater** (`api.krater.ai`, OpenAI-compatible) | Default drafter for real code diffs (implementer) | `KRATER_API_KEY` / `_5` at `~/.config/krater/credentials` (only 1 of 5 slots live as of 2026-09-16) — `_2` still needs a plan upgrade (403 "requires Pro, Ultra, or Max plan"), `_3` is still suspended (403 "Account suspended. Contact support."), `_4` still 402 "Payment past due", and base `KRATER_API_KEY` **newly failed** this check with the same 402 "Payment past due" + live Stripe invoice link (`invoice.stripe.com/i/acct_1TmZ3gIbrUte8ifi/...`) — was alive as of 2026-09-10, so this is a real regression. Only `_5` is usable right now; none of the dead ones are fixable by rotating a new key, they need that Stripe invoice paid. | Metered, ~$0.0003/call seen this check (varies with response length) | 🟢 alive (1 of 5 slots: `_5` only) — live-pinged fresh 2026-09-16, real `pong`. Same file also serves skrivox's separate Cloud Run deployment (see `reference_skrivox_krater_deprioritized_zai_coding` in this account's memory) — this credentials file is the account-wide source of truth for the key, not expaify-specific; expaify's own runtime never calls Krater directly (confirmed via repo-wide grep), it's used here only as a dev-pipeline implementer. **Gotcha:** `max_tokens: 20` on a short/structured ask can silently return empty content (reasoning eats the whole budget, `finish_reason: length`) — always give real headroom (e.g. `max_tokens: 500`). Draft, verify, don't ship blind — see Maker/checker section below, written from a real incident with this exact agent's output. | 2026-09-16 |
| **Codex CLI** (`codex exec --sandbox workspace-write`) | Implementer for multi-file/mechanical changes needing real tsc/test execution; verifier (runs the actual gate) | ChatGPT OAuth, `~/.codex/auth.json` | Flat subscription, not metered per-call | 🔴 dead — real fresh failure 2026-09-16 dispatching the anchor-date fix: `ERROR: You've hit your usage limit. ... try again at Sep 20th, 2026 12:03 PM.` Not an auth issue (was 🟢 as of 2026-09-08) — genuine plan usage cap, self-resolves 2026-09-20. Fell back to Grok CLI for that task. | 2026-09-16 |
| **Grok CLI** (`@xai-official/grok` / `x.ai/cli/install.sh`, `grok -p "..." --always-approve`) | Backup implementer while Codex is down; **strongest current option for the adversarial-checker/audit role** (agentic — explores the live repo itself rather than working from a pasted excerpt) | `grok login` (OAuth device-code, `~/.grok/auth.json`) — **not** `XAI_API_KEY` | Rides the SuperGrok subscription's own usage allowance via the CLI's chat-proxy path, not the metered developer API | 🟢 alive — re-pinged fresh 2026-09-10 (unchanged) (`pong`). Proven well beyond a liveness ping on 2026-09-04: given a diff + real incident context and told to find what shipping-blind would miss, it independently explored the live repo (not just the pasted diff), re-derived the real detection query's grouping, and correctly found a genuine ship-blocking bug (market-wide vs. per-hotel maturity counting) the orchestrator's own tsc+test+live-DB verification had missed. Every claim it made was independently re-checked against real schema/code/data before being accepted — all of them held up. Takes real time for a deep review (~10-15 min for a multi-file architectural pass); run it backgrounded, not inline. **Gotcha:** the `XAI_API_KEY` env var path is a *separate* auth mode hitting `api.x.ai`'s pay-per-token developer billing — still 🔴 dead (no credits). SuperGrok does NOT fund the API-key path; only `grok login` (OAuth) rides the subscription. Always use `grok login`, never `XAI_API_KEY`. | 2026-09-04 |
| **Gemini** (`gemini-3.5-flash`) | Persona-stage docs (UXD/UXR/UXDES, adversarial TEST review) — lighter text generation, not code diffs | `GEMINI_API_KEY` at `~/.config/gemini/credentials` | Metered | 🟢 alive — re-pinged fresh 2026-09-10 (unchanged) (`pong`, `finishReason: STOP`). Ran all 4 persona stages on DEAL-RATING-PROVENANCE-01. **Gotcha (live-confirmed 2026-08-19):** this model spends `generationConfig.maxOutputTokens` on internal thinking first — a plain `maxOutputTokens: 4000` request returned `finishReason: MAX_TOKENS` with only ~300 chars of real text (`thoughtsTokenCount` ate the rest). Fix: pass `generationConfig.thinkingConfig.thinkingBudget` (e.g. `2000`) to cap thinking, and/or set `maxOutputTokens` to 2-3x what you expect the prose to need. | 2026-08-19 |
| **RapidAPI ChatGPT-4** (`chatgpt-42.p.rapidapi.com`) | Backup drafter when Krater is down | `RAPIDAPI_KEY_6` at `~/.config/rapidapi/credentials` | Metered via RapidAPI, tight per-second rate limit | 🟢 alive — live-pinged `POST /gpt4`, real completion returned | 2026-08-19 |
| **io.net** (`api.intelligence.io.solutions`) | Backup drafter, last resort before direct authorship | key at `~/.config/ionet/credentials` | Metered | 🟢 **alive, prior 🔴 was a wrong-path false negative** — the dead verdict tested `/v1/chat/completions`; the real route is `/api/v1/chat/completions` (note the `/api` prefix). Live-pinged `meta-llama/Llama-3.3-70B-Instruct` there just now, got a real 200 completion. Un-firing it — move up the hire order to right after Gemini until proven otherwise. | 2026-08-19 |
| **Z.ai** (`api.z.ai/api/paas/v4`, OpenAI-compatible) | Backup drafter — only liveness-verified so far, not yet proven on a real code diff | `ZAI_API_KEY` at `~/.config/zai/credentials` | Free tier (`glm-4.5-flash`); other model names tried (`glm-4-flash`, `glm-4-flash-250414`) 400'd as unknown, and `glm-4.6` alone 429'd on account balance — only `glm-4.5-flash` confirmed reachable | 🔴 dead — re-checked again 2026-09-10 (3rd confirmation): requests to `api.z.ai` both hung with 0 bytes received (15s timeout), not an auth rejection — genuine host/connectivity failure, not a bad key (key file present, correct format, untouched). Was 🟢 alive 2026-08-23. Skip until a fresh check succeeds; not fixable by rotating a key. | 2026-09-10 |
| **Manus.im** (`api.manus.ai`) | Standalone autonomous background task runner — NOT a peer drafter (async, own sandbox/browser, poll for completion) | `MANUS_API_KEY` at `~/.config/manus/credentials` | Unknown | 🟡 integration incomplete — `task.create` works, result-retrieval endpoint unconfirmed (not re-checked this session) | 2026-08-13 |
| **Cursor Cloud Agents** (`api.cursor.com`, REST, `POST /v1/agents`, model id `composer-2.5`) | Structurally different from every row above: does not touch this local checkout — clones the real GitHub repo into Cursor's own cloud VM, works there, pushes a real branch and opens a real PR (draft by default) | `CURSOR_API_KEY` at `~/.config/cursor/credentials` | Metered | 🟢 confirmed connected 2026-09-16 — `GET /v1/repositories` lists both `expaify/expaify` and `expaify/skrivox` under this key's GitHub App install, so it's available here, not just skrivox. Full end-to-end dispatch (create → poll to FINISHED → independently verify via `gh pr view`/`gh pr diff`, not just Cursor's own report → clean up) was proven against `expaify/skrivox` specifically (see that repo's FLEET.md), not yet run against this repo — the access grant is confirmed real, a live PR-producing test against `expaify/expaify` itself is not. | 2026-09-16 |
| **expaify-fleet-orchestrator** (cloud cron, `trig_011raq3JMJkkGQqLUedg2UhG`) | Predecessor unattended hourly routine, same 6-stage pipeline | hardcoded Krater + Gemini keys in its own prompt | — | ⚫ disabled since 2026-08-05 (fired once, then off) | 2026-08-12 |
| Direct authorship (this Claude session writing the diff itself) | Absolute last resort | — | Session credit | Always available | — |

## Hire/fire order (implementer role)

**Krater → Codex (when Krater output is unusable, or the task needs real
command execution) → Grok CLI → Gemini → io.net → Z.ai → RapidAPI ChatGPT-4 →
direct authorship.** (io.net moved back above RapidAPI ChatGPT-4 on
2026-08-19 — see registry note above; it was never actually dead, just
probed on the wrong path. Z.ai added 2026-08-23 — slotted before RapidAPI
since it's free where RapidAPI is metered, but it's unproven on a real code
diff so far; only a liveness ping has succeeded. Re-evaluate its position
once it's actually carried a real implementer task. **Codex is 🔴 dead as of
2026-09-04** — real OAuth 401, needs `codex login` by the account holder;
Grok CLI slotted in right after it since it's the only other agent proven on
a real code-gen prompt, not just a liveness ping — use `grok login` auth,
never `XAI_API_KEY`, see registry note.)

"Fire" an agent by flipping its `status` to 🔴 and dating it the moment a
live call fails (not a guess) — e.g. Krater went 🔴 on 2026-08-12 (`402
insufficient_credits`), got "rehired" 🟢 on 2026-08-13 once the user funded a
new key. Never skip an agent based on a stale 🔴 without one fresh check first
— balances and endpoints have flipped mid-session before (io.net's 429→404,
Krater's 402→200).

## Maker/checker split

Every real code change: an **implementer** produces the diff; a
**different agent, acting as an adversarial checker, reviews the actual
diff** before it ships — not a second pass by the same implementer, and
not the orchestrator's own read-through standing in for it. This is
**mandatory, not "preferred,"** for any change touching
counting/threshold/aggregation logic (deal detection, scoring, paywall
gating, pipeline scheduling): the highest-value bugs in this codebase
hide exactly there, and they read as correct on a normal pass.

**Why this is non-negotiable — real incident, 2026-09-04:** a per-market
deal-scheduling fix was implemented (Krater), then verified by the
orchestrator via tsc, the full test suite, AND a live query against the
real production DB that appeared to confirm correct behavior — and it
still shipped a real bug. The "is this anchor mature" check counted
market-wide distinct scan-days as a stand-in for per-hotel snapshot
depth. That's invisible from reading the code or from "does it query and
return something plausible" testing: on this codebase, different
providers write disjoint hotel-id sets and only one provider's hotels
get stored per night (first success wins, no merge), so the aggregate
could read "mature" while the specific hotels it was supposed to gate
never accumulated enough real history. A second agent (Grok, no prior
investment in the diff being right) caught it by re-deriving the real
detection query's grouping and tracing one concrete failure scenario —
a single 429 during the healing window — end to end.

**Generalize this**: whenever a fix introduces a count/aggregate as a
proxy for a per-entity threshold, a second agent must answer "does this
aggregate track the exact same population the downstream gate checks,"
with a concrete failure scenario, before it ships. That is the single
highest-leverage adversarial question on this codebase.

**Second real incident, 2026-09-16, same function again:** the follow-up
fix to `getAnchorCheckInDate` (widening from 3 candidate anchor dates to
6, to address the 09-04 fragmentation issue above) was implemented by
Grok CLI: candidates generated as `today + [14,21,30,45,60,75] days`.
tsc passed, all 21 tests passed (Grok wrote/updated them itself, and
they were correct for what they tested — the point-in-time date math).
Independent review by Gemini (never touched the implementation) caught
a fatal flaw the tests never could: because every candidate is computed
relative to `today`, the entire pool shifts forward by exactly one day
every single night, so no check-in date is EVER queried twice — depth
can never exceed 1, for any market, ever. This doesn't slow deal
detection down, it makes it permanently impossible sitewide, strictly
worse than the bug it was meant to fix. Confirmed independently in
seconds with a 5-line Node script simulating 5 consecutive "today"
values, not by re-reading the diff harder. The flawed commit
(`9d7e26e`) was reverted before merge. **Lesson restated**: unit tests
written by the same pass that wrote the fix will faithfully test the
bug's own assumptions — a temporal/multi-night invariant (does this
value stay stable across consecutive calls where "today" advances) is
exactly the kind of thing a single-point-in-time test suite cannot
catch, and exactly what an independent reviewer is for. The corrected
version must anchor candidates to a fixed, non-drifting grid (e.g. the
original calendar 1st/15th walk, just extended to 6 iterations instead
of 3) so a given candidate date remains selectable across many
consecutive nights.

The orchestrator must independently re-verify every finding the checker
raises against real code/data before accepting or acting on it — a
confident-sounding audit is not automatically a correct one, the same
standard applied to the implementer's output. Both directions get
verified, never just one taken on faith.

Verifier gate mechanics: `npx tsc --noEmit --incremental false` + `npm
test -- --passWithNoTests`, run for real, not asserted. But this is
necessary, not sufficient, for anything gating money/detection/paywall
logic — those additionally require either a live check against real
production data, or a fresh unit test purpose-written to catch the
specific failure mode under review, before being considered verified.
Codex is preferred for the tsc/test verifier role specifically because
it can execute commands itself; Grok CLI (agentic, reads the live repo
rather than a pasted excerpt) is the strongest current option for the
adversarial-checker role on anything non-trivial — proven 2026-09-04 on
a real multi-file architecture-level review, not just a liveness ping.

## Human gate

Auto-commit (no pause) for: same-repo mechanical fixes, dead-code removal,
test additions, doc/pipeline-config changes like this file — reversible via
git, already the working pattern all session. Escalate to the user first
for: force-push/history-rewrite, anything touching Stripe/payment code paths,
re-enabling `expaify-fleet-orchestrator` or any other unattended cron that
would commit without a live session watching, and installing new third-party
dependencies/tooling (per the 2026-08-14 decision to hand-adopt
loop/fleet-engineering's patterns rather than run their npm CLI suite
against this repo).

See also: `AGENTS.md` (stage personas + non-negotiable contract),
`project_expaify_agent_fleet_backlog.md` in this account's memory (history of
the predecessor cron and the 28-feature unmerged backlog it left behind).
