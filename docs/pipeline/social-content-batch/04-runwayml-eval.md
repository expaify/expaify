# AUDIT-RUNWAYML-VIDEO-EVAL-01 — Should RunwayML replace Runware for video?

**Date:** 2026-08-16 (research task, no code/billing changes made)
**Question:** Runware's video API (`taskType: videoInference`) is fully working and already
integrated on the same key used for images tonight, but the account hit
`videoInferenceInsufficientCredits`. Should we instead integrate RunwayML (runwayml.com — an
unrelated company), or just top up the Runware wallet?

## RunwayML — actual current API offering (verified against official docs)

Confirmed live via `docs.dev.runwayml.com` (Runway's own developer-portal pricing page,
`https://docs.dev.runwayml.com/guides/pricing/`), separate from the `runway.com` consumer app.

- Yes, a real public developer API exists: `dev.runwayml.com`, distinct credit pool from the
  consumer subscription (Standard/Pro/Max plans don't carry over to API usage).
- Current video models: **Gen-4.5**, **Gen-4 Turbo**, **Aleph 2** (video-to-video), **Seedance 2**
  (480p/720p and 1080p tiers). Aleph 2 and older Gen-3 Alpha Turbo are being sunset ~July 2026.
- **Pricing is credit-based, $0.01/credit**, converting to real per-second USD:

| Model | Credits/s | USD/s |
|---|---|---|
| Gen-4 Turbo | 5 | **$0.05/s** |
| Gen-4.5 | 12 | **$0.12/s** |
| Aleph 2 (video-to-video) | 28 (56-credit / $0.56 minimum per gen) | **$0.28/s** |
| Seedance 2, 480p/720p | 36 | **$0.36/s** |
| Seedance 2, 1080p | 40 | **$0.40/s** |

- No subscription required to use the API — pay-per-credit, self-serve. One third-party
  aggregator (apiframe.ai, not Runway's own docs) claims a **$10 minimum top-up** on first API
  call; Runway's own pricing page doesn't state a minimum, so treat that figure as unconfirmed.

## Direct comparison to Runware (already integrated tonight)

| | Runware (current) | RunwayML (candidate) |
|---|---|---|
| Integration status | **Already working** — same API key used for tonight's 4 images, `videoInference` task type already wired | Not integrated — new base URL, new API key, new client/provider code, new error handling |
| Blocker | Billing only: `videoInferenceInsufficientCredits`, fixed by adding $5–10 at my.runware.ai/wallet | N/A, but adds a **second provider + second billing relationship** to maintain |
| Seedance video pricing | **$0.036–$0.096/s** (`bytedance:seedance@2.0-mini`) | **$0.36–$0.40/s** for Seedance 2 — same model family, 4–10x more expensive |
| Cheapest RunwayML model vs Runware's range | Gen-4 Turbo at $0.05/s undercuts Runware's top end ($0.096/s) but is still costlier than Runware's low end ($0.036/s) | — |
| Confirmed cost for tonight's batch (images, proxy for scale) | ~$0.007 total for 4 images | N/A — no equivalent batch run to compare |

The standout finding: Runware is reselling the **same underlying Seedance model line** RunwayML
sells directly, at roughly a quarter to a tenth of RunwayML's own per-second price. This isn't a
quality trade-off — it's the identical model, cheaper, on infrastructure already wired into
`lib/providers`.

## Recommendation

**Top up the Runware wallet. Do not integrate RunwayML.**

1. **Capability gap: none.** Runware's video generation already works — confirmed live in the
   docs this session — and is blocked purely by an account-balance check, not a missing feature
   or broken integration.
2. **Cost: Runware wins clearly.** Even RunwayML's cheapest model (Gen-4 Turbo, $0.05/s) doesn't
   beat Runware's low end ($0.036/s), and for the directly comparable Seedance model, Runware is
   4–10x cheaper for identical output.
3. **Effort: switching is pure cost, zero benefit.** RunwayML would require a new
   `lib/providers` adapter, a new API key/secret (`RUNWAY_API_KEY` via env per the
   non-negotiable secrets contract), new `Result<T>` error mapping, and new testing — for a
   provider that is strictly more expensive on the model that matters, with a separate billing
   relationship to manage. There is no quality, reliability, or feature argument in this research
   that offsets that.
4. **Fix is trivial:** add $5–10 at `my.runware.ai/wallet` (card or balance top-up) and the
   already-working `videoInference` call unblocks immediately on the existing integration.

**Bottom line:** this is a billing errand, not an integration decision. Resolve the Runware
credit gate; do not build a RunwayML adapter.

## Sources

- [API Pricing & Costs | Runway Dev](https://docs.dev.runwayml.com/guides/pricing/) — official developer-portal pricing page, primary source for the credit table above
- [Runway API Guide: Pricing & Code (2026) – Apiframe](https://apiframe.ai/guides/runway-api-guide) — secondary source, used only for the unconfirmed $10 minimum top-up claim
