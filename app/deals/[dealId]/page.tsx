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

function metadataEntries(metadata: DealDetail['metadata']) {
  return Object.entries(metadata).filter(([, value]) => value !== null && value !== '');
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

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Price
                  </p>
                  <p className="mt-2 font-display text-4xl font-extrabold leading-none text-white tabular-nums">
                    {price}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Deal score
                  </p>
                  {deal.dealScore !== undefined ? (
                    <p className="mt-2 font-display text-4xl font-extrabold leading-none text-emerald-300 tabular-nums">
                      {Math.round(deal.dealScore)}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-semibold text-gray-400">Not scored yet</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
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
                        {key.replaceAll('_', ' ')}
                      </p>
                      <p className="truncate text-sm font-semibold text-gray-300">{String(value)}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              <a
                href={deal.bookingUrl}
                className="btn-primary mt-auto"
                rel="nofollow sponsored noopener"
                target="_blank"
              >
                View deal
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
