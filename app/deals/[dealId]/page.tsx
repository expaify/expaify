import { notFound } from 'next/navigation';
import { getDealDetail } from '../../../lib/deals/dealDetail';
import type { DealDetail } from '../../../lib/deals/dealDetailTypes';

type PageProps = {
  params: Promise<{ dealId: string }>;
};

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function formatMetadataLabel(key: string): string {
  const knownLabels: Record<string, string> = {
    airline: 'Airline',
    arrival: 'Arrival',
    cabin: 'Cabin',
    carrier: 'Airline',
    checkIn: 'Check-in',
    check_in: 'Check-in',
    checkOut: 'Check-out',
    check_out: 'Check-out',
    destination: 'Destination',
    destinationIata: 'Destination',
    destination_iata: 'Destination',
    duration: 'Duration',
    guests: 'Guests',
    nights: 'Nights',
    origin: 'Origin',
    originIata: 'Origin',
    origin_iata: 'Origin',
    refundable: 'Refundable',
    roomType: 'Room type',
    room_type: 'Room type',
    stops: 'Stops',
  };

  const label = knownLabels[key] ?? key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .trim();

  return label
    .split(/\s+/)
    .map(word => (word.length <= 3 && word === word.toUpperCase()
      ? word
      : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`))
    .join(' ');
}

function formatMetadataValue(value: string | number | boolean | null): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

function metadataEntries(metadata: DealDetail['metadata']) {
  const hiddenKeys = new Set([
    'bookingUrl',
    'booking_url',
    'dealScore',
    'deal_score',
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
  ]);

  return Object.entries(metadata).filter(([key, value]) => (
    !hiddenKeys.has(key) && value !== null && value !== ''
  ));
}

function dealScorePanelClasses(deal: DealDetail): string {
  if (deal.scoreConfidence === 'low') return 'border-amber-500/20 bg-amber-500/10';
  if (deal.scoreVerdict === 'Great') return 'border-emerald-500/20 bg-emerald-500/10';
  if (deal.scoreVerdict === 'Good') return 'border-blue-500/20 bg-blue-500/10';
  return 'border-white/10 bg-white/[0.035]';
}

function dealScoreLabel(deal: DealDetail): string {
  if (deal.scoreConfidence === 'low') return 'Limited history';
  return deal.scoreVerdict ?? 'Not enough pricing history';
}

function dealScoreSummary(deal: DealDetail): string {
  if (deal.scoreConfidence === 'low') {
    return 'Not enough pricing history for a confirmed deal rating.';
  }

  if (deal.scoreVerdict && deal.dealScore !== undefined) {
    return `${deal.scoreVerdict} deal score ${Math.round(deal.dealScore)}`;
  }

  if (deal.scoreVerdict) return `${deal.scoreVerdict} deal`;
  if (deal.dealScore !== undefined) return `Deal score ${Math.round(deal.dealScore)}`;
  return 'Not enough pricing history to explain this price yet.';
}

function dealScoreDetails(deal: DealDetail): string[] {
  const details: string[] = [];

  if (deal.scoreConfidence === 'high') details.push('High confidence');
  if (deal.scorePercentile !== undefined && deal.scoreConfidence !== 'low') {
    details.push(`${Math.round(deal.scorePercentile)}th percentile`);
  }
  if (deal.scorePctVsMedian !== undefined && deal.scoreConfidence !== 'low') {
    const direction = deal.scorePctVsMedian <= 0 ? 'below' : 'above';
    details.push(`${formatPercent(Math.abs(deal.scorePctVsMedian))} ${direction} usual`);
  }

  return details;
}

export default async function DealDetailPage({ params }: PageProps) {
  const { dealId } = await params;
  const deal = await getDealDetail(dealId);

  if (!deal) notFound();

  const price = formatMoney(deal.price, deal.currency);
  const details = metadataEntries(deal.metadata);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_34rem),var(--bg-base)] px-4 py-6 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <a href="/" className="btn-pill w-fit">
          Back to search
        </a>

        <section className="card overflow-hidden rounded-2xl">
          <div className="grid gap-0 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="relative min-h-56 overflow-hidden bg-[#111827] sm:min-h-72 lg:min-h-full">
              {deal.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={deal.imageUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 shimmer" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#07091A] via-[#07091A]/45 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5">
                <span className="btn-pill border-white/15 bg-black/35 text-gray-100 backdrop-blur">
                  {deal.kind === 'flight' ? 'Flight deal' : 'Hotel deal'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-6 p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="btn-pill active cursor-default">{deal.provider}</span>
                {deal.expiresAt ? (
                  <span className="btn-pill cursor-default">
                    Expires {formatDateTime(deal.expiresAt)}
                  </span>
                ) : null}
              </div>

              <div>
                <h1 className="font-display text-3xl font-extrabold leading-tight tracking-normal text-white sm:text-4xl">
                  {deal.title}
                </h1>
                <p className="mt-3 text-base leading-7 text-gray-400">{deal.subtitle}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-[0.82fr_1.18fr]">
                <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Price
                  </p>
                  <p className="mt-2 font-display text-4xl font-extrabold leading-none text-white tabular-nums">
                    {price}
                  </p>
                </div>

                <div className={`rounded-xl border p-4 ${dealScorePanelClasses(deal)}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Deal Score
                      </p>
                      <p className="mt-2 text-lg font-bold leading-6 text-white">
                        {dealScoreSummary(deal)}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 rounded-full border border-white/10 bg-black/15 px-2.5 py-1 text-xs font-semibold text-gray-200">
                      {dealScoreLabel(deal)}
                    </span>
                  </div>
                  {dealScoreDetails(deal).length > 0 ? (
                    <p className="mt-2 text-xs font-semibold leading-5 text-gray-400">
                      {dealScoreDetails(deal).join(' · ')}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-gray-300">
                    {deal.scoreExplanation ?? 'Not enough pricing history to explain this price yet.'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Last updated
                </p>
                <p className="mt-1 text-sm font-semibold text-gray-200">
                  {formatDateTime(deal.updatedAt)}
                </p>
              </div>

              {details.length > 0 ? (
                <div className="grid gap-2 border-t border-white/8 pt-5 sm:grid-cols-2">
                  {details.map(([key, value]) => (
                    <div key={key} className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                        {formatMetadataLabel(key)}
                      </p>
                      <p className="truncate text-sm font-semibold text-gray-300">
                        {formatMetadataValue(value)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {deal.bookingUrl ? (
                <div className="mt-auto space-y-2">
                  <a
                    href={deal.bookingUrl}
                    className="btn-primary"
                    rel="nofollow sponsored noopener noreferrer"
                    target="_blank"
                  >
                    Check availability with {deal.provider}
                  </a>
                  <p className="text-center text-xs leading-5 text-gray-500">
                    Opens the provider site. Prices and availability can change.
                  </p>
                </div>
              ) : (
                <div className="mt-auto rounded-xl border border-white/10 bg-white/[0.025] p-4">
                  <p className="text-sm font-semibold text-gray-200">Provider link unavailable</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    This saved deal can be reviewed here, but Expaify does not have a current external booking link.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
