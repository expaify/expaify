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
| **Krater** (`api.krater.ai`, OpenAI-compatible) | Default drafter for real code diffs (implementer) | `KRATER_API_KEY` / `KRATER_API_KEY_2` at `~/.config/krater/credentials` (rotate on 402) | Metered, cheap (~$0.000007/call seen) | 🟢 alive | 2026-08-14 |
| **Codex CLI** (`codex exec --sandbox workspace-write`) | Implementer for multi-file/mechanical changes needing real tsc/test execution; verifier (runs the actual gate) | ChatGPT OAuth, `~/.codex/auth.json` | Flat subscription, not metered per-call | 🟢 alive — ran DEV-DEAL-RATING-PROVENANCE-01 end to end (6 files, tsc+jest both 0) | 2026-08-19 |
| **Gemini** (`gemini-3.5-flash`) | Persona-stage docs (UXD/UXR/UXDES, adversarial TEST review) — lighter text generation, not code diffs | `GEMINI_API_KEY` at `~/.config/gemini/credentials` | Metered | 🟢 alive — ran all 4 persona stages on DEAL-RATING-PROVENANCE-01. **Gotcha (live-confirmed 2026-08-19):** this model spends `generationConfig.maxOutputTokens` on internal thinking first — a plain `maxOutputTokens: 4000` request returned `finishReason: MAX_TOKENS` with only ~300 chars of real text (`thoughtsTokenCount` ate the rest). Fix: pass `generationConfig.thinkingConfig.thinkingBudget` (e.g. `2000`) to cap thinking, and/or set `maxOutputTokens` to 2-3x what you expect the prose to need. | 2026-08-19 |
| **RapidAPI ChatGPT-4** (`chatgpt-42.p.rapidapi.com`) | Backup drafter when Krater is down | `RAPIDAPI_KEY_6` at `~/.config/rapidapi/credentials` | Metered via RapidAPI, tight per-second rate limit | 🟡 unverified this session | 2026-08-13 |
| **io.net** (`api.intelligence.io.solutions`) | Backup drafter, last resort before direct authorship | key at `~/.config/ionet/credentials` | Metered | 🔴 dead — `/v1/chat/completions` 404s on every model tried | 2026-08-12 |
| **Manus.im** (`api.manus.ai`) | Standalone autonomous background task runner — NOT a peer drafter (async, own sandbox/browser, poll for completion) | `MANUS_API_KEY` at `~/.config/manus/credentials` | Unknown | 🟡 integration incomplete — `task.create` works, result-retrieval endpoint unconfirmed | 2026-08-13 |
| **expaify-fleet-orchestrator** (cloud cron, `trig_011raq3JMJkkGQqLUedg2UhG`) | Predecessor unattended hourly routine, same 6-stage pipeline | hardcoded Krater + Gemini keys in its own prompt | — | ⚫ disabled since 2026-08-05 (fired once, then off) | 2026-08-12 |
| Direct authorship (this Claude session writing the diff itself) | Absolute last resort | — | Session credit | Always available | — |

## Hire/fire order (implementer role)

**Krater → Codex (when Krater output is unusable, or the task needs real
command execution) → Gemini → RapidAPI ChatGPT-4 → io.net → direct
authorship.**

"Fire" an agent by flipping its `status` to 🔴 and dating it the moment a
live call fails (not a guess) — e.g. Krater went 🔴 on 2026-08-12 (`402
insufficient_credits`), got "rehired" 🟢 on 2026-08-13 once the user funded a
new key. Never skip an agent based on a stale 🔴 without one fresh check first
— balances and endpoints have flipped mid-session before (io.net's 429→404,
Krater's 402→200).

## Maker/checker split

Every real code change: an **implementer** (Krater draft, or Codex doing the
edit directly) produces the diff; a **verifier** step (`npx tsc --noEmit
--incremental false` + `npm test -- --passWithNoTests`, run for real, not
asserted) gates it before commit. Codex is preferred for the verifier role
specifically because it can execute commands itself rather than the
orchestrator taking the implementer's word for it.

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
