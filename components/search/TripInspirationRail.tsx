'use client'

import type { JSX } from 'react';
import { getTripInspiration, type TripInspirationTheme } from '@/lib/search/tripInspiration';

export type TripInspirationRailProps = {
  originIata: string;
  originDisplay?: string;
  onSelect: (selection: {
    originIata: string;
    originDisplay?: string;
    destinationIata: string;
    destinationDisplay?: string;
    departDate: string;
    returnDate: string;
    flexible: true;
  }) => void;
};

const THEME_LABELS: Record<TripInspirationTheme, string> = {
  beach: 'Beach',
  city: 'City',
  food: 'Food',
  culture: 'Culture',
  outdoors: 'Outdoors',
  last_minute: 'Last minute',
};

export function TripInspirationRail({
  originIata,
  originDisplay,
  onSelect,
}: TripInspirationRailProps): JSX.Element {
  const items = getTripInspiration(originIata);

  return (
    <section aria-label="Trip inspiration" className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400 dot-pulse" />
          <h2 className="font-display truncate text-xs font-extrabold uppercase tracking-[0.14em] text-gray-500">
            Trip ideas
          </h2>
        </div>
        <span className="hidden shrink-0 text-[11px] font-semibold text-gray-600 sm:inline">
          Flexible dates
        </span>
      </div>

      <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2 scrollbar-hide">
        {items.map((item) => {
          const departDate = firstFridayOfMonth(item.suggestedMonth);
          const returnDate = addDaysIso(departDate, item.minNights);
          const themeLabel = THEME_LABELS[item.theme];

          return (
            <button
              key={item.id}
              type="button"
              aria-label={`${themeLabel} trip to ${item.destinationCity} in ${item.suggestedMonth}, ${item.minNights} to ${item.maxNights} nights from about $${item.priceHintUsd}`}
              onClick={() => {
                onSelect({
                  originIata: item.originIata,
                  originDisplay: formatSelectionOriginDisplay(originDisplay, item.originIata),
                  destinationIata: item.destinationIata,
                  destinationDisplay: formatAirportDisplay(item.destinationCity, item.destinationIata),
                  departDate,
                  returnDate,
                  flexible: true,
                });
              }}
              className="card flex h-28 w-44 shrink-0 snap-start flex-col items-start justify-between overflow-hidden rounded-2xl p-3 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 sm:w-48"
            >
              <span className="btn-pill max-w-full truncate px-2 py-0.5 text-[10px]">
                {themeLabel}
              </span>
              <span className="min-w-0 max-w-full">
                <span className="font-display block max-w-full truncate text-base font-extrabold leading-tight text-white">
                  {item.destinationCity}
                </span>
                <span className="block max-w-full truncate text-[11px] font-medium text-gray-500">
                  {item.suggestedMonth} - {item.minNights}-{item.maxNights} nights
                </span>
              </span>
              <span className="text-xs font-bold text-indigo-300">
                From ${item.priceHintUsd}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function firstFridayOfMonth(month: string): string {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const date = new Date(Date.UTC(year, monthIndex, 1));

  while (date.getUTCDay() !== 5) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  return formatIsoDate(date);
}

function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatIsoDate(date);
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatAirportDisplay(city: string, iata: string): string {
  return `${city} (${iata})`;
}

function formatSelectionOriginDisplay(originDisplay: string | undefined, originIata: string) {
  const display = originDisplay?.trim();
  if (!display) return undefined;

  const displayIata = display.match(/\(([A-Z]{3})\)$/)?.[1];
  if (!displayIata || displayIata === originIata) return display;

  const city = display.replace(/\s*\([A-Z]{3}\)$/, '').trim();
  return city ? formatAirportDisplay(city, originIata) : undefined;
}
