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
| **Krater** (`api.krater.ai`, OpenAI-compatible) | Default drafter for real code diffs (implementer) | `KRATER_API_KEY_4` / `_5` at `~/.config/krater/credentials` — `_1`/`_2`/`_3` are SUSPENDED (403, needs account holder to contact Krater support, not fixable by key rotation) | Metered, ~$0.0003/call seen this check (varies with response length) | 🟢 alive — `KRATER_API_KEY_4` live-pinged 2026-09-04 with real headroom (`max_tokens: 500`, not the default) after a `max_tokens: 20` call silently returned empty content (reasoning ate the whole budget, `finish_reason: length` — same known gotcha as always, see below). Used for a real implementer task same day (per-market anchor-scheduling fix); produced usable code but with 2 real bugs the orchestrator had to catch before it typechecked (missing import, wrong query-result access) — draft, verify, don't ship blind. | 2026-09-04 |
| **Codex CLI** (`codex exec --sandbox workspace-write`) | Implementer for multi-file/mechanical changes needing real tsc/test execution; verifier (runs the actual gate) | ChatGPT OAuth, `~/.codex/auth.json` | Flat subscription, not metered per-call | 🔴 dead — real `401 Unauthorized` from `wss://api.openai.com/v1/responses` and the HTTPS fallback, both live-pinged twice (2026-09-03 during a real dispatch, re-confirmed fresh 2026-09-04, not a stale check). OAuth token needs re-auth (`codex login`) by whoever holds that account — not fixable by rotating a key from here. Implementer role fell through to direct authorship both times this affected. | 2026-09-04 |
| **Grok CLI** (`@xai-official/grok` / `x.ai/cli/install.sh`, `grok -p "..." --always-approve`) | Backup implementer while Codex is down; **strongest current option for the adversarial-checker/audit role** (agentic — explores the live repo itself rather than working from a pasted excerpt) | `grok login` (OAuth device-code, `~/.grok/auth.json`) — **not** `XAI_API_KEY` | Rides the SuperGrok subscription's own usage allowance via the CLI's chat-proxy path, not the metered developer API | 🟢 alive — proven well beyond a liveness ping on 2026-09-04: given a diff + real incident context and told to find what shipping-blind would miss, it independently explored the live repo (not just the pasted diff), re-derived the real detection query's grouping, and correctly found a genuine ship-blocking bug (market-wide vs. per-hotel maturity counting) the orchestrator's own tsc+test+live-DB verification had missed. Every claim it made was independently re-checked against real schema/code/data before being accepted — all of them held up. Takes real time for a deep review (~10-15 min for a multi-file architectural pass); run it backgrounded, not inline. **Gotcha:** the `XAI_API_KEY` env var path is a *separate* auth mode hitting `api.x.ai`'s pay-per-token developer billing — still 🔴 dead (no credits). SuperGrok does NOT fund the API-key path; only `grok login` (OAuth) rides the subscription. Always use `grok login`, never `XAI_API_KEY`. | 2026-09-04 |
| **Gemini** (`gemini-3.5-flash`) | Persona-stage docs (UXD/UXR/UXDES, adversarial TEST review) — lighter text generation, not code diffs | `GEMINI_API_KEY` at `~/.config/gemini/credentials` | Metered | 🟢 alive — ran all 4 persona stages on DEAL-RATING-PROVENANCE-01. **Gotcha (live-confirmed 2026-08-19):** this model spends `generationConfig.maxOutputTokens` on internal thinking first — a plain `maxOutputTokens: 4000` request returned `finishReason: MAX_TOKENS` with only ~300 chars of real text (`thoughtsTokenCount` ate the rest). Fix: pass `generationConfig.thinkingConfig.thinkingBudget` (e.g. `2000`) to cap thinking, and/or set `maxOutputTokens` to 2-3x what you expect the prose to need. | 2026-08-19 |
| **RapidAPI ChatGPT-4** (`chatgpt-42.p.rapidapi.com`) | Backup drafter when Krater is down | `RAPIDAPI_KEY_6` at `~/.config/rapidapi/credentials` | Metered via RapidAPI, tight per-second rate limit | 🟢 alive — live-pinged `POST /gpt4`, real completion returned | 2026-08-19 |
| **io.net** (`api.intelligence.io.solutions`) | Backup drafter, last resort before direct authorship | key at `~/.config/ionet/credentials` | Metered | 🟢 **alive, prior 🔴 was a wrong-path false negative** — the dead verdict tested `/v1/chat/completions`; the real route is `/api/v1/chat/completions` (note the `/api` prefix). Live-pinged `meta-llama/Llama-3.3-70B-Instruct` there just now, got a real 200 completion. Un-firing it — move up the hire order to right after Gemini until proven otherwise. | 2026-08-19 |
| **Z.ai** (`api.z.ai/api/paas/v4`, OpenAI-compatible) | Backup drafter — only liveness-verified so far, not yet proven on a real code diff | `ZAI_API_KEY` at `~/.config/zai/credentials` | Free tier (`glm-4.5-flash`); other model names tried (`glm-4-flash`, `glm-4-flash-250414`) 400'd as unknown, and `glm-4.6` alone 429'd on account balance — only `glm-4.5-flash` confirmed reachable | 🟢 alive — live-pinged `glm-4.5-flash`, real completion returned. **Gotcha (live-confirmed 2026-08-23):** same reasoning-eats-tokens failure mode as Krater/Gemini, but the *fix* is different — Krater's anti-reasoning system-prompt trick does NOT work here (still burned the full budget on `reasoning_content`, empty `content`). The real fix is a request-body field: `"thinking": {"type": "disabled"}`. With that set, response came back clean (`content: "pong"`, `finish_reason: "stop"`, 2 completion tokens). Always set this field when using this agent for anything short/structured. | 2026-08-23 |
| **Manus.im** (`api.manus.ai`) | Standalone autonomous background task runner — NOT a peer drafter (async, own sandbox/browser, poll for completion) | `MANUS_API_KEY` at `~/.config/manus/credentials` | Unknown | 🟡 integration incomplete — `task.create` works, result-retrieval endpoint unconfirmed (not re-checked this session) | 2026-08-13 |
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
