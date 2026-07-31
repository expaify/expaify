# UXR-HOTEL-PAYMENT-OPTIONS-01 — Hotel Payment-Option Confidence

**Stage:** UX Research · **Ticket:** UXR-HOTEL-PAYMENT-OPTIONS-01 · **Priority:** P0  
**Date:** 2026-07-31 · **Feature slug:** `hotel-payment-options`  
**Upstream:** `docs/pipeline/hotel-payment-options/01-discovery.md`  
**Reused contract:** `docs/pipeline/hotel-payment-timing/02-research.md` and `03-design.md`  
**Downstream:** `UXDES-HOTEL-PAYMENT-OPTIONS-01`

---

## Research question

Before leaving expaify, can a first-time traveler tell whether the **same room and rate** has one payment
path or a genuine choice between paying before arrival and paying at the property, and whether their expected
method is explicitly accepted for the **stay price** by the party that collects it—or correctly report that
the provider did not supply that evidence?

## Executive finding

No. The active product cannot represent or display any stay-price payment option, and its handoff structure
makes a property- or provider-level shortcut especially unsafe.

1. **The normalized contract has zero payment-option capacity.** `HotelOffer`, `HotelSearchPage`,
   `HotelProvider`, and `BookingHotelContext` carry neither a set of payment alternatives nor an accepted-
   method list. The existing payment-timing design defines one `statement`, which can describe one charge
   path but cannot say that two compatible paths are available for the same room/rate. Current structural
   coverage for option plurality and stay-price methods is therefore 0%.
2. **The shipped deal path never owns a room/rate.** `DealFeed` renders saved deal records into `DealCard`;
   the card opens a saved-deal detail, whose action is `Check rooms with provider`. `CompareRow` can expose
   Expedia, Booking, Kiwi, and Trip.com links for one observed property price. Occupancy and room are recorded
   as `not_captured` on handoff. Room and rate selection happens after departure, so expaify cannot truthfully
   attach a payment option to the displayed price or to all four partner buttons.
3. **The only visible “Payment method” is for a different financial event.** The funds-policy panel renders
   `HotelFundsEvidenceRecord.paymentMethodWording` under deposits and card holds. That field identifies the
   method to which an additional-funds obligation applies. It is not evidence that the same method can pay
   the stay price, and it must not be reused, copied, or merged into this disclosure.
4. **Reference systems make payment evidence progressively authoritative.** Booking.com exposes indicative
   timing at search/availability, property/supplier methods at details, and the final timing-method
   combination at order preview. It explicitly instructs integrations to show multiple available timings
   as separate choices and to validate the chosen combination at preview. Expedia Rapid returns room/rate
   shopping data, then a dynamic payment-options response; accepted cards vary with property location,
   currency, and collect model. Both patterns make rate selection and collector essential, not optional
   metadata.
5. **A card can have two different jobs.** In a pay-at-property flow, a card returned at preview may only
   guarantee the reservation or cover cancellation/no-show exposure; it does not prove that the property
   accepts that card to settle the stay. Expedia's property-collect flow also requires a security card and
   permits several pre-arrival transactions. “Pay at property,” “card required now,” “card accepted for the
   stay,” and “nothing charged before arrival” must remain four separate claims.
6. **The honest shippable state today is provider-level unsupported plus rate-level unknown.** Hotellook's
   cache entry has only property identity, location, price-from, property type, amenities, and smoking data.
   The saved-deal record persists an observed price and partner links, not rate payment terms. A populated
   disclosure would be fabricated. The smallest repair is to extend—not replace—the existing timing contract
   with an option set and stay-price method evidence, while placing a concise unsupported explanation at the
   result-set level and a rate-selection confirmation requirement at handoff.

---

## Inputs and method

### Current-code evidence audited in this worktree

| Surface / file | Evidence read | Finding |
|---|---|---|
| `app/deals/DealFeed.tsx` | `ApiDeal`, result mapping, detail URL | Feed data contains price, dates, snapshots, and OTA links; no room/rate or payment evidence. |
| `app/components/ui/DealCard.tsx` | collapsed saved-deal card | Price and Deal Score context are primary; no payment timing, plurality, method, collector, or unknown cue. |
| `app/deals/[dealId]/page.tsx` | saved-deal detail and provider section | The observed nightly rate is attributed only to “a booking partner”; room selection remains downstream. |
| `app/components/HotelDealCriteria.tsx` | `HotelDealCriteriaHandoff` | The provider-confirmation list omits timing and accepted methods. |
| `app/components/ui/CompareRow.tsx` | provider buttons, accessible names, analytics | One property can lead to four partners. Handoff records `occupancy_state` and `room_state` as `not_captured`; the accessible name omits payment options. |
| `app/components/HotelCard.tsx` | richer, currently unmounted offer card | `providerConfirmationCopy` omits timing/methods; `HotelOffer` evidence can reach `/book`, but no payment-option field exists. |
| `app/book/BookingFlow.tsx` | hotel review, CTA accessible name, return reasons | The last expaify-controlled gate names price, fees, transport, and smoking but not payment options. Return reasons contain no payment timing/method reason. |
| `lib/types.ts` | `HotelOffer`, `HotelProvider`, funds and eligibility evidence | No stay-payment option/method type. `paymentMethodWording` belongs only to a deposit/hold record. |
| `lib/providers/hotellook.ts` | cache entry, both normalizers, provider surface | No rate identifier or payment field; both normalization paths already preserve other unsupported/not-returned states explicitly. |
| `lib/booking/config.ts` | `BookingHotelContext`, validation and serialization | `roomId`/`rateId` are accepted only in the input allowlist but are not members of the returned hotel context; no payment option survives card → review. |
| `app/components/HotelFundsPolicyPanel.tsx` | obligation detail rendering | “Payment method” is visibly nested within `Deposits and card holds`; it must remain scoped to that obligation. |

`HotelCard` has no production call site outside tests on this branch. The shipped result → detail → provider
path therefore governs placement decisions in this brief; the richer `HotelCard` → `/book` path is specified
as a future-compatible surface, not treated as current reach.

### Reference-pattern evidence

References are used for interaction and information-architecture guidance only. They are not evidence about
any expaify property or rate.

- **Booking.com Demand API.** Payment timing, method, and schedule are independent concepts. Search and
  availability provide high-level timing; details provides methods for the selected product; order preview
  returns the final methods for the selected timing and is the source of truth. If multiple timings are
  returned, both must be displayed and the traveler chooses one. For pay-at-property, methods returned at
  order preview may only secure cancellation or no-show exposure, while property payment methods come from
  accommodation details. Sources: [Accommodation payments quick guide](https://developers.booking.com/demand/docs/payments/how-to-accommodation-payments),
  [Payment methods](https://developers.booking.com/demand/docs/payments/payments-methods), and
  [Create orders](https://developers.booking.com/demand/docs/orders-api/order-preview-create).
- **Expedia Rapid.** Shopping returns specific rooms/rates and tokenized next-step links; payment options are
  retrieved dynamically and price check verifies the selected rate. Accepted cards vary by currency,
  property location, and property-collect support; only returned card types may be displayed. Property
  collect means in-person settlement but still requires card details for security and can involve
  preauthorization, a nominal validation charge, deposits, or non-refundable charges before arrival.
  Sources: [Rapid Lodging flow](https://developers.expediagroup.com/rapid/lodging),
  [Credit card policies](https://developers.expediagroup.com/rapid/lodging/reference/credit-cards?locale=en_US),
  and [Property collect payments](https://developers.expediagroup.com/rapid/lodging/booking/property-collect).

### What transfers and what does not

| Reference pattern | Transfer to expaify | Do not transfer |
|---|---|---|
| Payment timing and method are separate but validated together | Preserve separate fields, associate both within a rate-specific option | Do not flatten to a badge such as `Pay later` |
| Multiple timings render as equivalent selectable choices | Represent true plurality and show sibling option rows with no preferred state | Do not add a selector; expaify cannot commit a provider choice |
| Final methods appear only after product/rate preview | Mark search/detail evidence as indicative and tell users where final confirmation occurs | Do not promote property-level methods to rate certainty |
| Accepted cards are dynamic | Render only explicit returned categories/networks, equally | Do not hardcode common brands or infer debit acceptance |
| Guarantee method differs from settlement method | Scope methods to `stay_price`; keep `cardRequiredAtBooking` separate | Do not reuse deposit/hold or cancellation/no-show card wording |

---

## 1. Current implementation audit

### 1.1 Active result scan: the displayed object is a saved price observation, not a rate

`ApiDeal` in `DealFeed.tsx` carries `hotelId`, `dealPriceCents`, `medianPriceCents`, `checkInDate`, `nights`,
and `otaLinks`. It has no occupancy, room id, rate id, source-rate id, payment contract, or evidence timestamp
for payment terms. `DealCard` then renders property, observed nightly price, comparison price, discount,
dates, and freshness before a single `View deal` action.

This means the card cannot distinguish any of the decision states in this ticket:

- one payment path versus two paths for the same room/rate;
- prepay-only versus pay-at-property-only;
- an explicitly accepted method versus an unmentioned method;
- a capability-unsupported provider versus a capable provider that omitted one offer; or
- property-level acceptance versus rate/collector acceptance.

**Delta:** reference systems attach payment availability to a selected product/rate. expaify's active card is
one level coarser than an offer and at least two levels coarser than a selected rate. Repeating “payment
options not provided” on every card would mislabel a dataset limitation as many independent offer facts and
would add warning noise to the price-led scan.

### 1.2 Detail and handoff: partner plurality is present, payment plurality is not

The saved-deal detail says `Check rooms with provider`. `HotelDealCriteriaHandoff` presents a single
confirmation sentence, then `CompareRow` can render Expedia, Booking, Kiwi, and Trip.com actions under
`Provider options`. Its click event records:

- `occupancy_state: 'not_captured'`;
- `room_state: 'not_captured'`; and
- a selected partner only at the instant of departure.

Those partner buttons do not represent interchangeable checkout channels for one fixed rate. Each can expose
different inventory, room names, payment timings, collectors, and accepted methods. A payment claim placed
above the whole row would read as common to all partners unless it explicitly says otherwise.

The current visible and accessible provider-confirmation enumerations name room details, availability, total,
taxes/fees, cancellation policy, and terms. Because they omit payment timing and accepted methods, the final
expaify instruction does not tell the traveler that these are unresolved rate-selection questions.

### 1.3 Rich offer/review path: transport exists, but the evidence object does not

`HotelOffer` can be normalized by a provider, passed into `HotelCard`, converted by
`buildBookingHotelContext`, optionally stored by reference, and rendered in `BookingFlow`. This is the right
transport path for future evidence, but neither `HotelOffer` nor `BookingHotelContext` has payment-option or
accepted-method fields.

Although `lib/booking/config.ts` includes `roomId` and `rateId` in an unknown-input allowlist, neither field is
part of `BookingHotelContext`, its validator return, or `buildBookingHotelContext`. Their presence does not
create rate continuity. The richer review therefore still cannot prove that evidence matches the room/rate
opened at the provider.

The review CTA's accessible name names the selected nightly rate, fee uncertainty, transport, and smoking.
It gives no payment-option instruction. The visible provider section likewise says the provider shows room
options and other policy details, but not which payment path or method to verify.

### 1.4 Existing timing contract: reusable foundation and exact missing piece

The upstream design already owns:

- five evidence states: `complete | partial | explicit_none | not_returned | conflicting`;
- `chargeEvent`, `collector`, `cardRequiredAtBooking`, and `deferredChargeOn`;
- source, scope, freshness, ordered missing fields, and capability flags;
- the rule that `at_property` plus missing card evidence is partial, never reassuring; and
- separation from price scope, refundability, deposits/holds, and settlement currency.

That contract must remain the only source of charge-event truth. Its one-statement shape, however, cannot
express **two simultaneously valid options**. It also cannot express methods accepted to settle the stay.
Adding a second standalone “methods policy” panel would lose the timing-method combination that reference
systems validate at preview. The smallest extension is an option set whose items reuse the existing timing
statement shape and attach stay-price method evidence to that item.

### 1.5 Provider capability and honest distribution

Structural coverage from source, not from a production sample:

| Source/path | Option plurality | Stay-price methods | Rate match | Achievable state |
|---|---:|---:|---:|---|
| Hotellook `cache.json` adapter | unsupported | unsupported | none | provider `unsupported`; offer/rate facts unknown |
| Saved deals + OTA links | unsupported | unsupported | none | dataset-level unsupported; partner selection happens after handoff |
| Booking.com Demand (not integrated) | supported at selected product; final at preview | property methods at details; final online/guarantee set at preview | product ids available | known/partial depending endpoint; method purpose must be distinguished |
| Expedia Rapid (not integrated) | collect model available on room/rate shopping path | dynamic accepted cards through payment-options | price-check token binds selected rate | known/partial depending collect model and response |

**Current expected distribution:** known single 0%; known choice 0%; partial 0%; conflicting 0%; capable-
provider omission 0%; provider unsupported 100%. This is a contract statement: the only wired data paths
cannot express the fields. It is not evidence that any property accepts or rejects any method.

### 1.6 Analytics can observe handoff, not payment comprehension

The shipped path records detail views, section reach, and `hotel_provider_handoff_clicked`. The richer review
tracks handoff/return behavior and offers return reasons for price/fees, room availability, smoking,
loyalty, other details, or no answer. No event contains payment-option state, and no return reason identifies
timing or method mismatch.

Payment-related abandonment is therefore not measurable today. A quick return is not evidence of a payment
problem. A future event can segment disclosed evidence states, but causal attribution still requires an
explicit traveler answer.

---

## 2. Smallest safe extension to the payment-timing contract

This is a research-level contract proposal for UXDES/DEV to validate. It intentionally reuses
`HotelPaymentTimingStatement`, `HotelPaymentTimingState`, `HotelFundsEvidenceScope`, source/freshness, and
capability concepts. It introduces no money field and no second charge-event vocabulary.

```ts
type HotelPaymentOptionSetState =
  | 'complete' | 'partial' | 'not_returned' | 'conflicting'

type HotelStayPaymentMethodCategory =
  | 'credit_card' | 'debit_card' | 'cash' | 'digital_wallet'
  | 'bank_transfer' | 'other'

type HotelStayPaymentMethod = {
  category: HotelStayPaymentMethodCategory
  /** Named network or provider-returned label; never inferred. */
  label?: string
}

type HotelStayPaymentMethodEvidence = {
  /** Complete means the source contract guarantees this is the exhaustive set. */
  state: 'complete' | 'partial' | 'not_returned' | 'conflicting'
  accepted: readonly HotelStayPaymentMethod[]
  /** Only explicit rejection, or absence from a source-guaranteed exhaustive set. */
  notAccepted?: readonly HotelStayPaymentMethod[]
  /** Fixed discriminator: guarantee/deposit methods never normalize here. */
  purpose: 'stay_price'
  collector?: HotelChargeCollector
  providerWording?: string
  missingFields?: readonly ('accepted_methods' | 'collector' | 'purpose' | 'scope' | 'source')[]
}

type HotelStayPaymentOption = {
  /** Stable provider option id; not a display label. */
  optionId: string
  /** Reuses the existing timing contract exactly. */
  timing: HotelPaymentTimingStatement
  methods: HotelStayPaymentMethodEvidence
}

type HotelPaymentOptionSet = {
  state: HotelPaymentOptionSetState
  options: readonly HotelStayPaymentOption[]
  sourceLabel: string
  scope: HotelFundsEvidenceScope
  fetchedAt?: string
  missingFields?: readonly ('option_plurality' | 'timing' | 'accepted_methods' | 'rate_scope' | 'source')[]
}

type HotelPaymentOptionCapability = {
  optionPlurality: boolean
  stayPaymentMethods: boolean
  exhaustiveMethodSet: boolean
  rateScoped: boolean
}
```

The exact field names are not the finding; these invariants are:

1. **One item equals one valid timing-method combination.** A set with `options.length > 1` can be called a
   choice only when every item applies to the same provider, room, rate family, dates, occupancy, and price
   context. Different OTA links, different rates, or conflicting statements are not choices.
2. **Timing is reused, never restated.** The item points to the existing timing statement shape. There is no
   second `payNow` / `payLater` boolean.
3. **Methods mean stay-price settlement only.** A card used for booking guarantee, deposit, authorization,
   cancellation, or no-show does not enter `accepted`. `cardRequiredAtBooking` remains on timing.
4. **Absence is not rejection.** An unmentioned method answers “not stated” unless the provider explicitly
   rejects it or its contract guarantees the returned set is exhaustive. `acceptedMethods: []` alone can
   never render “not accepted.”
5. **Scope and collector must agree.** A property-accepted method can support the property-collected option;
   it cannot support a booking-partner-collected option. A method response with no identifiable purpose or
   collector degrades to partial/not-returned.
6. **Capability gates reassurance.** A provider with `optionPlurality: false` cannot emit “one payment option”;
   it emits unsupported. A provider with `exhaustiveMethodSet: false` cannot infer explicit non-acceptance.

### State and fallback definitions

| Display state | Evidence rule | Exact meaning | Forbidden interpretation |
|---|---|---|---|
| **Known · single** | Capability supports plurality; exactly one complete, rate-matched option | One documented payment path for this provider room/rate | “All providers offer only this” |
| **Known · choice** | Capability supports plurality; 2+ complete compatible options for the same room/rate/context | Traveler can choose among the shown paths at the named provider | Different rates/partners are a choice |
| **Partial** | At least one usable fact, but timing, method set, collector, purpose, or rate match is incomplete | Some facts are known; named fields still require confirmation | Missing method means accepted/rejected |
| **Conflicting** | 2+ retained statements disagree for the same scoped option | The source disagrees; expaify withholds a conclusion | Two disagreements are two choices |
| **Unsupported** | Adapter capability is false for plurality and/or stay methods | expaify's source cannot supply this dimension | The property has no option/method |
| **Unknown / not returned** | Capability is true, but this scoped rate returned no evidence | The capable source did not state it for this rate | Pay at property, card accepted, or no prepayment |
| **Error** | Fetch/validation failed | expaify could not check | Provider omitted it |

`explicit_none` remains defined only by the timing contract (“nothing collected and no card charged before
arrival”). It is **not** a valid method-evidence state: a bookable stay must have some settlement mechanism,
even when that mechanism is not documented.

---

## 3. Testable design directives

### D1 — Extend the existing timing disclosure into one “How and when you pay” system

Use one shared disclosure hierarchy, never a timing panel plus a separate methods panel:

1. option availability: one path / genuine same-rate choice / not known;
2. charge timing from the existing timing contract;
3. collector;
4. methods explicitly accepted for the stay price;
5. rate scope, source, freshness, and missing fields.

The existing `When you are charged` component/copy module remains the source of timing language. UXDES may
rename the expanded heading to **`How and when you pay`** only if the collapsed timing clause and all timing
state copy still resolve from that module; it must not fork the lexicon.

Acceptance checks:

- no `payNow`, `payLater`, `payAtProperty`, or accepted-card inference exists outside the evidence normalizer;
- `HotelFundsEvidenceRecord.paymentMethodWording` is never read by payment-option code;
- no method or option affects price, sort, filtering, or Deal Score; and
- every rendered option identifies one collector and one rate scope, or is visibly partial.

### D2 — Match disclosure density to the active journey and its actual evidence scope

**Result scan (`DealFeed` / `DealCard`).** With the current all-unsupported data path, render one result-set
explanation near the coverage/status boundary, not a warning on every card:

> **Payment options appear after room selection**  
> These saved prices do not include rate-level payment timing or accepted methods. Check both after choosing
> a room and rate with a provider.

This text is secondary to result count, price, and Deal Score; it is not a card badge, filter, or alert. If a
future dataset gains same-rate evidence, a collapsed card may show only the existing timing clause plus
`2 ways to pay` when and only when plurality is complete. Accepted method names never appear on result cards.

**Saved-deal detail / provider handoff.** Place the full fallback immediately before `CompareRow`, after the
stay-context sentence. Current unsupported copy:

> **Payment options not available from this saved price**  
> expaify does not have rate-level payment timing or accepted methods for this saved price. Each provider may
> show different rooms, rates, and payment terms. After choosing a room and rate, confirm when the stay price
> is charged and whether your payment method is accepted.

Amend every visible and accessible provider-confirmation enumeration to include **`payment timing and
accepted methods`** after `taxes and fees`. The primary action remains `Check rooms at {Provider}`; payment
copy must not imply that clicking commits payment.

**Richer `HotelCard` / `/book` path.** When rate-matched evidence exists, place the full disclosure after
price/Deal Score and before deposits/holds. When it does not, use the same fallback, naming the partner as the
confirmation destination but never deriving collector from its hostname.

Acceptance checks at 375px and 1280px: no card gains an extra warning row in the current unsupported state;
fallback text wraps without truncation; provider actions remain at least 44px high; composed accessible names
include the unresolved payment check without becoming the sole location of that information.

### D3 — Render genuine plurality as equal sibling options; never confuse alternatives with conflict

When a provider returns 2+ compatible options for the same scoped room/rate, show:

> **2 ways to pay for this rate**

Then render one non-interactive sibling row per option, preserving source order, for example:

- `Pay at booking` · `Booking partner collects` · `Visa and Mastercard stated`
- `Pay at the property` · `Property collects` · `Cash and Visa stated`

Rows use equal type, spacing, and tone. No row is selected, recommended, green, cheaper-looking, or placed
behind “more.” expaify does not own the provider's selector. If evidence is tied to one of several provider
buttons, place it with that provider only; never float it above `CompareRow` as a shared property fact.

State copy:

| State | Heading/status | Required body rule |
|---|---|---|
| Known single | `1 payment path stated for this rate` | Show timing, collector, methods, scope/source. Do not imply another path is unavailable beyond this source/rate. |
| Known choice | `{n} ways to pay for this rate` | Show every compatible option equally. |
| Partial | `Payment options partly stated` | `Not stated: {ordered missing fields}. Confirm for your selected room and rate.` |
| Conflicting | `Payment details conflict` | `Provider statements disagree. expaify is showing them without choosing one.` Show equally attributed statements, not option rows. |
| Unsupported | `Payment options not available from expaify` | Name the unsupported source/path and where rate-level confirmation occurs. |
| Unknown | `Payment options not stated for this rate` | Include: `This is not the same as pay at the property or your method being accepted.` |
| Error | `Payment options could not be checked` | Include: `This does not mean pay at the property is available.` Offer retry only if a real retry method exists. |

Acceptance checks:

- a fixture containing two different providers or two different rate ids never renders `{n} ways to pay`;
- `conflicting` never renders as a selectable/valid alternative set;
- a one-item response from a plurality-unsupported adapter renders unsupported, not `1 payment path`; and
- provider source order is preserved; no client sorting implies preference.

### D4 — Make accepted-method evidence answer “for what charge?” before naming a card

The full disclosure labels methods **`Accepted for the stay price`**. It may render normalized categories and
named networks only when explicitly returned, with provider wording available in detail. Method logos are
optional decoration only; text names are mandatory and equal in prominence.

Three-valued expected-method answer, implemented as a pure helper and tested:

- **Yes** only when the expected category/network is explicitly in `accepted` for `purpose: 'stay_price'`,
  with matching collector and rate scope.
- **No** only when the source explicitly returns it in `notAccepted`, or an authoritative source contract
  guarantees a complete exhaustive set and the method is absent.
- **Not stated** for every other case, including partial lists, guarantee cards, deposit/hold wording,
  unknown collector, property-level evidence attached to a rate, or method evidence from another provider.

Required separation copy when `cardRequiredAtBooking === true` and stay methods are unknown:

> A card is required to secure this booking. The provider did not state whether that card can pay the stay
> price.

Required separation copy for pay-at-property when preview methods are guarantee-only:

> These methods secure the reservation. The property’s accepted methods for the stay price were not stated.

Acceptance checks:

- `Credit or debit card` in `HotelFundsPolicyPanel` never produces accepted stay methods;
- a returned Visa guarantee card plus unknown property methods answers `Not stated` for “Can I pay the stay
  with Visa?”;
- a complete `accepted: [Visa, Mastercard]` set can answer `No` for Amex only when the adapter declares the
  set exhaustive; and
- debit is never inferred from a credit-card network label or from provider UI conventions.

### D5 — Validate comprehension before adding choice UI or conversion claims

Extend the payment-timing prototype mechanism with paired option/method fixtures; do not wait for live
provider coverage. The fixture set must include:

1. one prepay-only option with explicit Visa/Mastercard stay-payment evidence;
2. one pay-at-property option with a booking-guarantee card but stay methods not returned;
3. a true same-rate choice with different method sets per option;
4. partial timing known / methods unknown;
5. capable-provider not returned;
6. provider unsupported;
7. two conflicting statements;
8. property-level cash acceptance attached to no specific rate (must degrade);
9. method evidence from a different provider (must degrade); and
10. load error.

Before handoff, ask in fixed order with `The provider did not say` always available:

1. “How many payment paths does this same room and rate offer?”
2. “Can you pay the stay price at the property?”
3. “Can you use {assigned expected method} to pay the stay price?”
4. “Who collects the stay payment?”
5. “Is a card required now only to secure the booking?”

Report separately:

- **false-choice errors:** treating two providers/rates or conflicting statements as a choice;
- **false-comfort errors:** inferring pay at property or method acceptance from missing evidence;
- **purpose errors:** treating a guarantee/deposit/hold method as a stay-payment method;
- **scope errors:** promoting property/provider evidence to the selected rate; and
- ordinary incorrect/over-cautious answers.

Ship gate for the prototype: zero false-comfort and zero purpose errors on the unsupported, not-returned, and
guarantee-only fixtures. Live analytics may record disclosure exposure, state, provider handoff, explicit
payment-related return reason, and method-evidence state. It may not label unexplained dwell, abandonment, or
return as payment-related.

---

## 4. Evidence-state hierarchy for UXDES

Primary on the handoff surface: **whether the selected rate is usable with the traveler's payment constraint**.
Secondary: timing/collector and accepted methods that support that answer. Tertiary: source, scope,
freshness, and verbatim provider wording. On result cards, price and Deal Score remain primary; the current
dataset-level unsupported cue is tertiary and appears once.

Every design state must preserve this order:

| State | Primary line | Secondary content | Confirmation action |
|---|---|---|---|
| Loading | `Checking payment options…` | Skeleton; no claims | none |
| Known single | `1 payment path stated for this rate` | timing → collector → stay methods | provider handoff |
| Known choice | `{n} ways to pay for this rate` | equal option rows | provider handoff; no expaify selection |
| Partial | `Payment options partly stated` | known facts + ordered missing fields | confirm selected rate |
| Empty/unknown | `Payment options not stated for this rate` | explicit non-equivalence | confirm selected rate |
| Unsupported | `Payment options not available from expaify` | capability/source explanation | check after room/rate selection |
| Conflicting | `Payment details conflict` | equally attributed statements | confirm; expaify chooses none |
| Error | `Payment options could not be checked` | explicit non-reassurance | retry if real, otherwise confirm |

Accessibility requirements handed forward:

- disclosure toggle uses a native button with `aria-expanded`, `aria-controls`, visible focus, and a unique id;
- known method names are text, not logo-only; status/tone is never color-only;
- settled unknown/unsupported states are not live regions; only loading and a newly surfaced error use
  polite status semantics;
- option rows are a semantic list, not disabled radio buttons; and
- at 375px, option labels and provider wording wrap with no horizontal scroll or line clamp on decision-
  critical content.

---

## 5. Decisions handed to UXDES / DEV

1. **Contract placement.** UXR recommends `HotelPaymentOptionSet` as an additive child of the existing
   `HotelPaymentTimingEvidence` system, not a separate policy panel and not a wider `priceBasis`. UXDES must
   preserve one disclosure; DEV owns the final TypeScript composition.
2. **Active-surface placement.** The current unsupported message appears once at result-set level and once at
   the saved-deal handoff, not on every `DealCard`. The richer `HotelCard` path receives the shared full
   disclosure for future/provider-fixture coverage.
3. **Provider association.** If evidence applies to one partner in `CompareRow`, it must be nested with that
   partner action. A property-level message cannot imply four providers share the same rate terms.
4. **Serialization.** The upstream timing design already budgets six scalar keys. Repeated option/method
   arrays must use the existing reference-backed hotel context, never be flattened into an unbounded query
   string. If reference storage is unavailable, degrade to partial/unknown; never drop scope or purpose first.

---

## 6. Out-of-scope findings

- `HotelCard` is not mounted in the production app outside tests. Consolidating the saved-deal and rich
  review journeys is an information-architecture project, not this ticket.
- Occupancy and room selection remain uncaptured at the saved-deal handoff. Without them, rate matching is
  impossible. Repair belongs to search/rate-context work.
- The booking-review return prompt has no payment timing/method reason. D5 records the measurement need;
  production copy/analytics changes belong to UI/DEV after UXDES specifies them.
- Hotellook cannot populate this contract. Provider procurement, partner-page scraping, and checkout
  automation are not authorized.
- Deposits, holds, cancellation/no-show charges, and settlement currency remain owned by their existing
  pipelines even when the same card appears in provider wording.
- Expedia's card-display parity obligations apply to a checkout that collects card details. expaify does not
  collect payment in this flow; the transferable principle is equal treatment of explicit methods, not a
  requirement to add logos or payment inputs.

---

## Quality bar and handoff

This brief separates current-code facts from reference guidance; quantifies current capability as 0% and
unsupported as 100% by contract; defines known single, known choice, partial, conflicting, unsupported,
unknown, loading, and error behavior; covers rate scope, collector, method purpose, 375px/1280px,
keyboard/screen-reader behavior, and test fixtures; and leaves no placeholder copy or TODO.

**Handoff:** `UXDES-HOTEL-PAYMENT-OPTIONS-01`, carrying this path plus the existing payment-timing research
and design spec. UXDES must specify the combined disclosure without creating a parallel timing model.
