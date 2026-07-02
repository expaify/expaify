import DealScorePanel from '@/app/components/DealScorePanel';
import { formatMoney, isValidMoney } from '@/lib/money';
import type { DealScore, Money } from '@/lib/types';
import { getDealDetail, isValidDealId } from '../../../lib/deals/dealDetail';
import type { DealDetail } from '../../../lib/deals/dealDetailTypes';

type PageProps = {
  params: Promise<{ dealId: string }>;
};

type FactItem = {
  label: string;
  value: string;
  available: boolean;
};

type PriceBasis =
  | 'traveler_fare'
  | 'passenger_total'
  | 'nightly_before_taxes_fees'
  | 'current_price_unknown_basis';

const HIDDEN_METADATA_KEYS = new Set([
  'area',
  'bookingUrl',
  'booking_url',
  'cabin',
  'carrier',
  'checkIn',
  'check_in',
  'checkOut',
  'check_out',
  'dealScore',
  'deal_score',
  'depart',
  'departure',
  'destination',
  'destinationIata',
  'destination_iata',
  'guests',
  'hotel',
  'hotelName',
  'hotel_name',
  'nights',
  'origin',
  'originIata',
  'origin_iata',
  'passengerCount',
  'passenger_count',
  'passengers',
  'priceBasis',
  'priceScope',
  'price_basis',
  'price_scope',
  'return',
  'returnDate',
  'return_date',
  'room',
  'roomOrRate',
  'roomType',
  'room_or_rate',
  'room_type',
  'scoreConfidence',
  'score_confidence',
  'scoreExplanation',
  'score_explanation',
  'scorePctVsMedian',
  'score_pct_vs_median',
  'scorePercentile',
  'score_percentile',
  'scoreVerdict',
  'score_verdict',
  'stops',
  'travelerCount',
  'traveler_count',
  'travelers',
]);

function normalizeMetadataValue(value: DealDetail['metadata'][string]): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function metadataValue(deal: DealDetail, keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeMetadataValue(deal.metadata[key]);
    if (value) return value;
  }

  return null;
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function metadataEntries(metadata: DealDetail['metadata']) {
  return Object.entries(metadata).filter(([key, value]) => (
    !HIDDEN_METADATA_KEYS.has(key) && normalizeMetadataValue(value) !== null
  ));
}

function formatMetadataLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim()
    .split(/\s+/)
    .map(word => (word.length <= 3 && word === word.toUpperCase()
      ? word
      : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`))
    .join(' ');
}

function stopsText(value: string | null): string | null {
  if (!value) return null;
  const stops = Number(value);
  if (!Number.isInteger(stops) || stops < 0) return value;
  if (stops === 0) return 'Nonstop';
  if (stops === 1) return '1 stop';
  return `${stops} stops`;
}

function travelersText(value: string | null): string | null {
  if (!value) return null;
  const travelers = Number(value);
  if (!Number.isInteger(travelers) || travelers < 1) return value;
  return travelers === 1 ? '1 traveler' : `${travelers} travelers`;
}

function nightsText(value: string | null): string | null {
  if (!value) return null;
  const nights = Number(value);
  if (!Number.isInteger(nights) || nights < 1) return value;
  return nights === 1 ? '1 night' : `${nights} nights`;
}

function guestsText(value: string | null): string | null {
  if (!value) return null;
  const guests = Number(value);
  if (!Number.isInteger(guests) || guests < 1) return value;
  return guests === 1 ? '1 guest' : `${guests} guests`;
}

function titleValue(value: string | null, fallback: string): string {
  return value ?? fallback;
}

function detailMoney(deal: DealDetail): Money {
  return {
    priceCents: deal.price,
    currency: deal.currency,
  };
}

function priceBasis(deal: DealDetail): PriceBasis {
  const explicit = metadataValue(deal, ['priceBasis', 'price_basis']);
  if (
    explicit === 'traveler_fare' ||
    explicit === 'passenger_total' ||
    explicit === 'nightly_before_taxes_fees' ||
    explicit === 'current_price_unknown_basis'
  ) {
    return explicit;
  }

  if (deal.kind === 'hotel') return 'nightly_before_taxes_fees';

  const scope = metadataValue(deal, ['priceScope', 'price_scope']);
  if (scope === 'party_total' || scope === 'passenger_total') return 'passenger_total';

  return 'traveler_fare';
}

function priceCopy(kind: DealDetail['kind'], basis: PriceBasis) {
  if (basis === 'traveler_fare') {
    return {
      label: 'Traveler fare',
      helper: 'Shown for one traveler unless the result says otherwise.',
    };
  }

  if (basis === 'passenger_total') {
    return {
      label: 'Passenger total',
      helper: 'Shown for the travelers in this search.',
    };
  }

  if (basis === 'nightly_before_taxes_fees') {
    return {
      label: 'Nightly rate before taxes and fees',
      helper: 'Taxes, fees, cancellation policy, and final total are confirmed by the provider.',
    };
  }

  return {
    label: kind === 'hotel' ? 'Nightly rate before taxes and fees' : 'Current price',
    helper: 'Provider confirms final price and availability.',
  };
}

function flightFacts(deal: DealDetail): FactItem[] {
  const origin = metadataValue(deal, ['origin', 'originIata', 'origin_iata']);
  const destination = metadataValue(deal, ['destination', 'destinationIata', 'destination_iata']);
  const depart = formatDate(metadataValue(deal, ['depart', 'departure']));
  const returnDate = formatDate(metadataValue(deal, ['return', 'returnDate', 'return_date']));
  const carrier = metadataValue(deal, ['carrier', 'airline']);
  const stops = stopsText(metadataValue(deal, ['stops']));
  const cabin = metadataValue(deal, ['cabin']);
  const travelers = travelersText(metadataValue(deal, [
    'travelers',
    'travelerCount',
    'traveler_count',
    'passengers',
    'passengerCount',
    'passenger_count',
  ]));

  return [
    { label: 'Origin', value: origin ?? 'Origin unavailable', available: Boolean(origin) },
    { label: 'Destination', value: destination ?? 'Destination unavailable', available: Boolean(destination) },
    { label: 'Depart', value: depart ?? 'Depart date unavailable', available: Boolean(depart) },
    { label: 'Return', value: returnDate ?? 'One-way or return date unavailable', available: Boolean(returnDate) },
    { label: 'Carrier', value: carrier ?? 'Carrier unavailable', available: Boolean(carrier) },
    { label: 'Stops', value: stops ?? 'Stops unavailable', available: Boolean(stops) },
    { label: 'Cabin', value: cabin ?? 'Cabin unavailable', available: Boolean(cabin) },
    { label: 'Travelers', value: travelers ?? 'Traveler count unavailable', available: Boolean(travelers) },
  ];
}

function hotelFacts(deal: DealDetail, basisLabel: string): FactItem[] {
  const hotel = metadataValue(deal, ['hotel', 'hotelName', 'hotel_name']) ?? deal.title;
  const area = metadataValue(deal, ['area', 'destination']);
  const checkIn = formatDate(metadataValue(deal, ['checkIn', 'check_in']));
  const checkOut = formatDate(metadataValue(deal, ['checkOut', 'check_out']));
  const nights = nightsText(metadataValue(deal, ['nights']));
  const guests = guestsText(metadataValue(deal, ['guests']));
  const roomOrRate = metadataValue(deal, ['roomOrRate', 'room_or_rate', 'roomType', 'room_type', 'room']);

  return [
    { label: 'Hotel', value: hotel || 'Hotel name unavailable', available: Boolean(hotel) },
    { label: 'Area', value: area ?? 'Area unavailable', available: Boolean(area) },
    { label: 'Check-in', value: checkIn ?? 'Check-in unavailable', available: Boolean(checkIn) },
    { label: 'Check-out', value: checkOut ?? 'Check-out unavailable', available: Boolean(checkOut) },
    { label: 'Nights', value: nights ?? 'Nights unavailable', available: Boolean(nights) },
    { label: 'Guests', value: guests ?? 'Guest count unavailable', available: Boolean(guests) },
    { label: 'Room or rate', value: roomOrRate ?? 'Room or rate unavailable', available: Boolean(roomOrRate) },
    { label: 'Price basis', value: basisLabel || 'Provider confirms final price and availability.', available: true },
  ];
}

function identityCopy(deal: DealDetail, facts: FactItem[]) {
  if (deal.kind === 'flight') {
    const origin = facts.find(fact => fact.label === 'Origin');
    const destination = facts.find(fact => fact.label === 'Destination');
    const depart = facts.find(fact => fact.label === 'Depart');
    const returnDate = facts.find(fact => fact.label === 'Return');
    const carrier = facts.find(fact => fact.label === 'Carrier');
    const stops = facts.find(fact => fact.label === 'Stops');
    const cabin = facts.find(fact => fact.label === 'Cabin');
    const identity = origin?.available && destination?.available
      ? `${origin.value} to ${destination.value}`
      : 'Flight deal details';
    const returnText = returnDate?.available ? ` to ${returnDate.value}` : ` · ${returnDate?.value}`;

    return {
      identity,
      subtitle: `${depart?.value}${returnText} · ${carrier?.value} · ${stops?.value} · ${cabin?.value}`,
    };
  }

  const hotel = facts.find(fact => fact.label === 'Hotel');
  const area = facts.find(fact => fact.label === 'Area');
  const checkIn = facts.find(fact => fact.label === 'Check-in');
  const checkOut = facts.find(fact => fact.label === 'Check-out');
  const nights = facts.find(fact => fact.label === 'Nights');
  const guests = facts.find(fact => fact.label === 'Guests');

  return {
    identity: hotel?.available ? hotel.value : 'Hotel deal details',
    subtitle: `${area?.value} · ${checkIn?.value} to ${checkOut?.value} · ${nights?.value} · ${guests?.value}`,
  };
}

function completeScore(deal: DealDetail): DealScore | null {
  if (
    typeof deal.scorePercentile !== 'number' ||
    typeof deal.scorePctVsMedian !== 'number' ||
    typeof deal.scoreVerdict !== 'string' ||
    typeof deal.scoreConfidence !== 'string' ||
    typeof deal.scoreExplanation !== 'string'
  ) {
    return null;
  }

  const medianCents = Number(metadataValue(deal, ['medianCents', 'median_cents', 'scoreMedianCents', 'score_median_cents']));
  if (!Number.isInteger(medianCents) || medianCents <= 0) return null;

  return {
    percentile: deal.scorePercentile,
    pctVsMedian: deal.scorePctVsMedian,
    medianCents,
    currency: deal.currency,
    verdict: deal.scoreVerdict,
    confidence: deal.scoreConfidence,
    explanation: deal.scoreExplanation,
  };
}

function partialScoreCopy(deal: DealDetail, score: DealScore | null): string {
  if (score) {
    return deal.kind === 'flight'
      ? 'We do not have enough route history to score this fare right now.'
      : 'We do not have enough hotel history to score this nightly rate right now.';
  }

  const hasSomeScoreEvidence = [
    deal.dealScore,
    deal.scoreVerdict,
    deal.scoreConfidence,
    deal.scoreExplanation,
    deal.scorePercentile,
    deal.scorePctVsMedian,
  ].some(value => value !== undefined);

  if (hasSomeScoreEvidence) {
    return 'Saved score evidence is incomplete, so expaify is not showing a deal rating for this detail.';
  }

  return deal.kind === 'flight'
    ? 'We do not have enough route history to score this fare right now.'
    : 'We do not have enough hotel history to score this nightly rate right now.';
}

function isExpired(expiresAt?: string): boolean {
  if (!expiresAt) return false;
  const date = new Date(expiresAt);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

function isStale(updatedAt: string): boolean {
  const date = new Date(updatedAt);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() - date.getTime() > 6 * 60 * 60 * 1000;
}

function isExternalHttpUrl(value?: string): value is string {
  if (!value) return false;

  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function FatalState({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-[color:var(--bg-base)] px-4 py-5 text-[color:var(--text-1)]">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <a href="/" className="btn-pill w-fit">
          Back to search
        </a>
        <section className="card p-5 sm:p-6">
          <h1 className="font-display text-2xl font-extrabold leading-tight tracking-normal text-[color:var(--text-1)]">
            {title}
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-[color:var(--text-2)]">
            {body}
          </p>
        </section>
      </div>
    </main>
  );
}

function Fact({ fact }: { fact: FactItem }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
        {fact.label}
      </p>
      <p
        className={`mt-0.5 [overflow-wrap:anywhere] text-sm font-semibold leading-5 ${
          fact.available ? 'text-[color:var(--text-1)]' : 'text-[color:var(--text-3)]'
        }`}
      >
        {fact.value}
      </p>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="rounded-[var(--radius-card)] border border-[color:var(--border-strong)] bg-[color:var(--warning-soft)] p-4"
      role="status"
    >
      <p className="text-sm font-bold text-[color:var(--text-1)]">{title}</p>
      <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-2)]">
        {body}
      </p>
    </div>
  );
}

function ProviderAction({
  deal,
  expired,
  hasValidBookingUrl,
}: {
  deal: DealDetail;
  expired: boolean;
  hasValidBookingUrl: boolean;
}) {
  if (expired) {
    return (
      <aside className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
        <p className="text-sm font-bold text-[color:var(--text-1)]">Deal expired</p>
        <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-2)]">
          This saved deal may no longer be available at the shown price. Search again to find current options.
        </p>
        <a href="/" className="btn-primary mt-3">
          Search current deals
        </a>
      </aside>
    );
  }

  if (hasValidBookingUrl) {
    return (
      <aside className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
        <a
          href={deal.bookingUrl}
          className="btn-primary"
          rel="nofollow sponsored noopener noreferrer"
          target="_blank"
        >
          Check availability with {deal.provider}
        </a>
        <p className="mt-2 text-center text-xs font-medium leading-5 text-[color:var(--text-2)]">
          Opens the provider site. Prices and availability can change.
        </p>
      </aside>
    );
  }

  return (
    <aside
      className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-muted)] p-4"
      role="status"
    >
      <p className="text-sm font-bold text-[color:var(--text-1)]">Provider link unavailable</p>
      <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-2)]">
        {deal.bookingUrl
          ? 'The saved provider link is not valid, so expaify is not sending you offsite.'
          : 'This saved deal can be reviewed here, but expaify does not have a current external booking link.'}
      </p>
      <button className="btn-primary mt-3" disabled>
        Unavailable
      </button>
    </aside>
  );
}

export default async function DealDetailPage({ params }: PageProps) {
  const { dealId } = await params;

  if (!isValidDealId(dealId)) {
    return (
      <FatalState
        title="Deal link is not valid"
        body="This deal link does not match an expaify deal format."
      />
    );
  }

  let deal: DealDetail | null = null;
  try {
    deal = await getDealDetail(dealId);
  } catch {
    return (
      <FatalState
        title="Deal details unavailable right now"
        body="Saved deal details are temporarily unavailable. Search results may still show current options."
      />
    );
  }

  if (!deal) {
    return (
      <FatalState
        title="Deal details unavailable"
        body="This saved deal could not be found. It may have been removed or replaced by newer prices."
      />
    );
  }

  const currentMoney = detailMoney(deal);
  const displayMoney = isValidMoney(currentMoney) ? formatMoney(currentMoney) : 'Price unavailable';
  const basis = priceBasis(deal);
  const { label: priceLabel, helper: priceHelper } = priceCopy(deal.kind, basis);
  const continuityFacts = deal.kind === 'flight'
    ? flightFacts(deal)
    : hotelFacts(deal, priceLabel);
  const { identity, subtitle } = identityCopy(deal, continuityFacts);
  const score = completeScore(deal);
  const details = metadataEntries(deal.metadata);
  const expired = isExpired(deal.expiresAt);
  const stale = !expired && isStale(deal.updatedAt);
  const hasValidBookingUrl = isExternalHttpUrl(deal.bookingUrl);
  const hasMissingContext = continuityFacts.some(fact => !fact.available);
  const freshnessCopy = `Updated ${formatDateTime(deal.updatedAt)}`;
  const expirationCopy = deal.expiresAt
    ? `${expired ? 'Expired' : 'Expires'} ${formatDateTime(deal.expiresAt)}`
    : null;

  return (
    <main className="min-h-screen bg-[color:var(--bg-base)] px-4 py-5 text-[color:var(--text-1)] sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        <a href="/" className="btn-pill w-fit">
          Back to search
        </a>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="flex min-w-0 flex-col gap-4">
            <section className="card overflow-hidden">
              <div className="grid gap-0">
                <div className="flex flex-col gap-4 p-4 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="btn-pill cursor-default">
                      {deal.kind === 'flight' ? 'Flight deal' : 'Hotel deal'}
                    </span>
                    <span className="btn-pill active cursor-default">{deal.provider}</span>
                    <span className="btn-pill cursor-default">{freshnessCopy}</span>
                    {expirationCopy ? (
                      <span className="btn-pill cursor-default">{expirationCopy}</span>
                    ) : null}
                  </div>

                  <div>
                    <h1 className="font-display text-2xl font-extrabold leading-tight tracking-normal text-[color:var(--text-1)] sm:text-3xl">
                      {titleValue(identity, deal.title)}
                    </h1>
                    <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--text-2)]">
                      {subtitle || deal.subtitle}
                    </p>
                  </div>

                  <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
                      {priceLabel}
                    </p>
                    <p className="mt-1 font-display text-4xl font-extrabold leading-none tracking-normal text-[color:var(--text-1)] tabular-nums">
                      {displayMoney}
                    </p>
                    <p className="mt-2 text-xs font-medium leading-5 text-[color:var(--text-2)]">
                      {priceHelper}
                    </p>
                  </section>

                  {hasMissingContext ? (
                    <Notice
                      title="Some deal details are missing"
                      body="expaify can show the saved price and provider, but some route or stay context was not saved with this deal."
                    />
                  ) : null}

                  <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4">
                    <h2 className="text-sm font-bold text-[color:var(--text-1)]">
                      {deal.kind === 'flight' ? 'Trip details' : 'Stay details'}
                    </h2>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {continuityFacts.map(fact => (
                        <Fact key={fact.label} fact={fact} />
                      ))}
                    </div>
                  </section>

                  <DealScorePanel
                    score={score}
                    loading={false}
                    scope={deal.kind === 'flight' ? 'route' : 'hotel'}
                    priceNoun={deal.kind === 'flight' ? 'fare' : 'nightly rate'}
                    unavailableCopy={partialScoreCopy(deal, score)}
                  />

                  {details.length > 0 ? (
                    <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-surface)] p-4">
                      <h2 className="text-sm font-bold text-[color:var(--text-1)]">More details</h2>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {details.map(([key, value]) => (
                          <div key={key} className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
                              {formatMetadataLabel(key)}
                            </p>
                            <p className="mt-0.5 [overflow-wrap:anywhere] text-sm font-semibold leading-5 text-[color:var(--text-1)]">
                              {normalizeMetadataValue(value)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>
            </section>
          </section>

          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-5 lg:self-start">
            <ProviderAction
              deal={deal}
              expired={expired}
              hasValidBookingUrl={hasValidBookingUrl}
            />

            {stale ? (
              <Notice
                title="Price may be stale"
                body="This deal was last updated more than 6 hours ago. The provider confirms the current price and availability."
              />
            ) : null}

            <section className="rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[color:var(--text-3)]">
                Freshness
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-[color:var(--text-1)]">
                {freshnessCopy}
              </p>
              {expirationCopy ? (
                <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--text-2)]">
                  {expirationCopy}
                </p>
              ) : null}
            </section>

            <section className="overflow-hidden rounded-[var(--radius-card)] border border-[color:var(--border)] bg-[color:var(--bg-raised)]">
              {deal.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deal.imageUrl}
                  alt=""
                  className="aspect-[4/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[4/3] items-center justify-center bg-[color:var(--bg-muted)] px-4 text-center text-xs font-semibold leading-5 text-[color:var(--text-3)]">
                  No image available
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
