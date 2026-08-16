# Zernio SMS/MMS setup investigation (AUDIT-ZERNIO-SMS-SETUP-01)

**Status:** Investigation only. Nothing provisioned, no registration filed, no real SMS sent, no
money spent. Every claim below is either a real `curl` call made this session against
`https://zernio.com/api/v1` or a direct quote/paraphrase from Zernio's own docs, pulled via
`https://docs.zernio.com/llms-full.txt` (a flat text dump of their docs site — much easier to grep
than extracting the `self.__next_f.push` Next.js payloads, and it turned out to contain the full
API reference too). TCPA info is grounded with a live web search, sources listed at the bottom.

## 1. Getting a NEW real phone number (not port-in)

Confirmed via docs: `POST /v1/phone-numbers/purchase`.

- **Payment-first, no number picking.** You don't browse and pick a specific number — the API
  auto-assigns one from inventory. Requires "usage-based billing" (their paid metered plan) and a
  card on file; no card returns `402 PAYMENT_REQUIRED`.
- **Cost, confirmed from docs (`/pricing/phone-numbers`, `/pricing/sms`):**
  - US number: **$3/month flat**, charged at activation and again on the 1st of every month.
    (Non-US ranges $3–$21/month depending on country, on a fixed price ladder.)
  - No setup fee — the monthly rate is the whole price.
  - Releasing a number stops future months; the current month is **not** refunded/prorated back.
- Regulated countries (not the US) need one-time KYC (1–3 business days) before the number
  activates; the US is instant.
- Useful request flags: `wantsSms: true` (provision from SMS-capable inventory — not guaranteed
  by default), `connectWhatsapp: false` (skip WhatsApp provisioning, standalone Calls/SMS number),
  `areaCode` (optional, can fail with `409 AREA_CODE_UNAVAILABLE` if that area has no stock).
- Duplicate-purchase guard: a second purchase within 10 minutes of a prior one is rejected
  (`409 PURCHASE_VELOCITY`) unless `allowMultiple: true` is passed — a safety rail, not a blocker.

**Not attempted** — this requires a payment method on file and immediately bills $3, which is
real money and out of scope for an investigation ticket.

## 2. 10DLC carrier registration (`POST /v1/sms/registrations`)

This is mandatory before any US number can actually deliver SMS — confirmed explicitly in the
send-SMS docs: *"US numbers must have an approved carrier registration
(`/v1/sms/registrations`) before messages deliver."*

**Cost (confirmed from `/pricing/sms`):**

| Fee | Price |
|---|---|
| Brand registration (one-time) | **$9** |
| Campaign fee — standard business use case | **$20/month** |
| Campaign fee — sole proprietor | **$4/month** |
| Reusing an approved registration on additional numbers | **Free** |

One approved brand+campaign registration covers every number on the account — you only pay the
brand fee once, ever, and attach more numbers later at no extra cost via
`POST /v1/phone-numbers/{id}/sms/reuse-registration`.

**What it requires, from the documented request body:**

- `registrationType`: `standard_10dlc` (company), `sole_prop_10dlc` (no EIN, verified instead by
  an OTP texted to the owner's mobile), or `toll_free`.
- `brand` object — the legal entity: `entityType` (e.g. `PRIVATE_PROFIT`), `displayName`,
  `companyName`, **`ein`** (US tax ID — required for standard_10dlc, not for sole-prop),
  `country`, `vertical` (industry category, e.g. `TECHNOLOGY`), full street address (`street`,
  `city`, `state`, `postalCode`), and a `website` (sole props may substitute a social profile URL).
  Company/non-profit/government brands also need a business `phone`.
- `campaign` object — what you'll send and how people opt in/out: a `usecase` (e.g.
  `CUSTOMER_CARE`), a `description`, a `messageFlow` (how consent is captured, e.g. "customers
  opt in at checkout by checking the SMS updates box"), opt-in/opt-out/help keywords and messages
  (auto-generated compliantly if omitted), and **two sample messages** (`sample1`, `sample2`,
  20+ characters each) — carriers reject sparse filings.
- If expaify doesn't want to source the legal business details directly, `POST
  /v1/sms/registrations/share` mints a 7-day single-use link so someone else (whoever owns the
  legal entity details) fills the form in — no Zernio login required, registration still lands
  under the expaify account.

**Approval timing:** Zernio's own docs only say approval is **asynchronous** and to "register
early... it can take time" — they do not commit to a specific SLA (poll
`GET /v1/sms/registrations/{id}`; status moves `pending` → `approved` or `rejected`, and can even
drop back from `approved` to `pending` if the carrier registry later suspends it). For general
context (not Zernio-specific, industry knowledge of The Campaign Registry / 10DLC): standard
company brand+campaign vetting is commonly same-day to a few business days, though it can extend
for certain verticals or if the carrier flags something; toll-free verification is a separate,
often slower process. Treat "a few business days, no hard guarantee" as the working assumption,
not a documented promise.

**Not attempted** — filing a real registration means submitting a real business's legal identity
(EIN, address) to a carrier registry and immediately incurring the $9 fee plus a recurring
monthly campaign fee. That's a business decision (see §5), not something to trigger from an
investigation ticket.

## 3. Can the existing sandbox number (+12029087457) send/receive real test SMS for free?

**No — confirmed two ways, and this is the most important finding in this doc.**

First, the docs are explicit that the "sandbox" object returned by the phone-numbers endpoint is
a **WhatsApp-only** sandbox, not a general SMS sandbox:

> `GET /v1/phone-numbers` → **sandbox** `object,null`: "The shared **WhatsApp** sandbox (one
> Zernio-owned number, all users test against it)... `template` is the only template a sandbox
> send is allowed to use."

The full sandbox docs (`/platforms/whatsapp/sandbox`) confirm the mechanics: it's reply-gated
(you text a real phone, the recipient must reply on WhatsApp to "activate" a session), locked to
exactly one Meta-approved template (`sandbox_start`, no merge fields), capped at 50 messages/5
recipients per day, and sends go through the WhatsApp inbox/conversation endpoints
(`POST /v1/inbox/conversations`), not the SMS API. It is billed free, but only because it's a
WhatsApp template flow — not because it's a general-purpose "free SMS testing" mode.

Second, I confirmed this empirically with one safe, zero-cost API call rather than trusting the
docs alone. I called the real SMS send endpoint using the sandbox number as the sender, with a
placeholder (non-real, unreachable) destination number, specifically so nothing could actually
be transmitted even if the call had unexpectedly succeeded:

```
POST /v1/sms/messages
{"from":"+12029087457","to":"+15555550123","text":"test - confirming sandbox is not SMS-capable, expect 404"}
```

Response: **`HTTP 404`**, `{"error":"No SMS-enabled number or sender ID +12029087457 on this
account","type":"not_found","code":"account_not_found"}`.

This is a pre-flight validation failure — the API checks the `from` number against your account's
list of SMS-enabled numbers before it goes anywhere near a carrier, so this call could not have
sent a real message, reached a real phone, or incurred any cost. It confirms the sandbox number
is genuinely not usable as an SMS sender at all: it doesn't appear in the `numbers` array (it's a
separate shared object), so it fails the same `from` check any random invalid string would.

**Conclusion: there is no free/sandboxed way to test the SMS send flow end-to-end.** The only
paths to a working `POST /v1/sms/messages` call are (a) buy a real US number ($3/mo) + complete
10DLC registration ($9 + $20-or-$4/mo, asynchronous approval), or (b) buy a real number in a
non-US country from the 54-country list, where the docs state SMS can send immediately with no
registration once SMS is enabled on the number — still a real $3–$21/month purchase, just skips
the 10DLC step. Neither is free. I did not attempt either, per the instruction to not provision
or spend money.

(One partial no-cost option that does exist and I did not need to explore further: alphanumeric
**Sender IDs** — `POST /v1/sms/sender-ids`, free to create, no number, no 10DLC — but these are
explicitly one-way, international-only, and cannot reach US/Canada/Puerto Rico numbers at all, so
they're irrelevant to testing a US SMS flow for expaify.)

## 4. TCPA compliance — real blocker, separate from the Zernio technical setup

Independent of anything Zernio-side, US law constrains who you're allowed to text for marketing
purposes at all, and expaify currently has **zero opted-in phone numbers** — there is no list to
send to yet regardless of whether the Zernio plumbing is ready.

Grounded via live web search (sources below), current baseline:

- **Prior express written consent is required** before sending marketing/promotional SMS to a
  consumer under the TCPA — a documented, specific opt-in tied to that phone number (a checkbox
  at signup, a keyword opt-in like texting "START" to a number, a web form), not an assumption of
  consent from an existing customer relationship. Consent must not be bundled as a condition of
  purchase.
- **Note on regional variance (2026):** a Fifth Circuit ruling (*Bradford v. Sovereign Pest
  Control*, Feb 2026) held the TCPA statute itself only requires "prior express consent," not
  "prior express written consent," inside that circuit (TX/LA/MS) — but the FCC's own rule still
  requires written consent everywhere else, and most carrier-facing 10DLC campaign vetting will
  still expect a written-consent-shaped `messageFlow` description regardless. Assume the stricter
  written-consent standard nationally unless legal counsel says otherwise.
- **Opt-out must be automatic and honored immediately** — replying STOP must stop future sends.
  Zernio's own docs confirm they handle this natively (`GET /v1/sms/opt-outs`, and
  `POST /v1/sms/messages` returns `409` rather than silently sending if the recipient already
  opted out) — so the mechanical enforcement side is covered by the platform once a registration
  exists. The consent-collection side (the actual opt-in UI/flow that gets a number onto the
  "allowed to text" list in the first place) does not exist yet and is not a Zernio feature —
  it's an expaify product build (e.g. an SMS-updates checkbox somewhere in a booking/signup flow,
  wired to only add numbers to Zernio's contact list after that explicit action).
- **Penalties are real and per-message**: statutory damages of $500–$1,500 per violation, plus
  class-action exposure — this is not a "just try it and see" risk category.

**This is a hard blocker for any real marketing SMS use, independent of whether the Zernio
technical setup (number + 10DLC) is finished.** Technical readiness does not create consent.

Sources:
- [ActiveProspect — TCPA text messages: Rules and regulations guide for 2026](https://activeprospect.com/blog/tcpa-text-messages/)
- [Holland & Knight — TCPA Reset: Fifth Circuit Rejects "Prior Express Written Consent" Rule (March 2026)](https://www.hklaw.com/en/insights/publications/2026/03/tcpa-reset-fifth-circuit-rejects-prior-express-written-consent-rule)
- [Nelson Mullins — The FCC's "Prior Express Written Consent" Rule is Changing This Month](https://www.nelsonmullins.com/insights/alerts/fcc-download/all/the-fcc-s-prior-express-written-consent-rule-is-changing-this-month-what-marketers-need-to-know)
- [TermsFeed — How to Get Legal Consent for SMS Marketing](https://www.termsfeed.com/blog/sms-marketing-consent/)

## 5. Recommendation

**Smallest safe next step (technical, no business decision needed):** nothing further to
investigate for free — this doc already covers the full technical path with real docs and one
safe confirmatory API call. If/when the business decides to proceed, the actual smallest paid
step is: buy one US number (`POST /v1/phone-numbers/purchase`, $3/mo) and immediately start a
10DLC `standard_10dlc` registration for it ($9 one-time + $20/mo, or $4/mo if filing as a sole
proprietor) — approval is asynchronous with no committed SLA from Zernio, so start it early and
poll `GET /v1/sms/registrations/{id}` rather than assuming a delivery date. Nothing sends until
that registration status is `approved`.

**Real blockers that need a business/product decision first, not an API call:**

1. **Money + who owns the legal filing.** The 10DLC brand registration requires real legal
   business details (EIN, registered address, entity type) and an ongoing ~$24–$29/month combined
   run rate minimum (number + campaign fee) before a single message can be sent. Someone needs to
   decide expaify will actually spend this and designate who supplies the legal/business details
   (`POST /v1/sms/registrations/share` can hand that specific sub-task to whoever owns it, e.g.
   finance/legal, without giving them Zernio API access).
2. **There is no opt-in mechanism today, and that's the real gating item, not Zernio.** Zero
   phone numbers are legally text-able right now. Building a compliant opt-in flow (explicit
   checkbox or keyword opt-in, stored consent record, immediate STOP handling — the last part
   Zernio already provides) is a real product task that has to happen before a 10DLC campaign
   registration is even meaningful, since the campaign filing itself asks you to describe *how*
   users opt in (`campaign.messageFlow`) — there needs to be a real answer to that question, not
   a placeholder, before filing.
3. **Decide the use case before registering**, since 10DLC campaigns are vetted per declared use
   case (e.g. `CUSTOMER_CARE` vs. marketing/promotional use cases are scrutinized differently, and
   marketing campaigns face materially more carrier scrutiny and can have lower default
   throughput). Filing as transactional/customer-care when the actual traffic will be marketing
   risks the registration being flagged or throttled later.

In short: the Zernio plumbing itself is straightforward and well-documented (buy number → enable
SMS → register 10DLC → send), and there is no way to dry-run it for free — the sandbox is
WhatsApp-only, confirmed both from docs and one live, harmless, zero-cost API call this session.
The actual blocking work before any of this is usable is not technical: it's deciding to spend
the money, assigning who supplies legal business details, and building the opt-in flow that
gives Zernio a legitimate list of numbers to text in the first place.
