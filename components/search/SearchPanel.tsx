'use client'

import * as React from 'react';
import type { FormEvent, JSX } from 'react';
import AirportInput from '@/app/components/AirportInput';
import { Reveal } from '@/app/components/ui/Reveal';
import { TripInspirationRail } from './TripInspirationRail';

type TripType = 'roundtrip' | 'oneway';
export type SearchIntent = 'flights' | 'hotels' | 'trip';

type SearchSelection = {
  originIata: string;
  originDisplay?: string;
  destinationIata: string;
  destinationDisplay?: string;
  departDate: string;
  returnDate: string;
  flexible: true;
};

type SearchPanelSelectionSetters = {
  setOrigin: React.Dispatch<React.SetStateAction<string>>;
  setOriginDisplay: React.Dispatch<React.SetStateAction<string>>;
  setDestination: React.Dispatch<React.SetStateAction<string>>;
  setDestinationDisplay: React.Dispatch<React.SetStateAction<string>>;
  setDepartDate: React.Dispatch<React.SetStateAction<string>>;
  setReturnDate: React.Dispatch<React.SetStateAction<string>>;
  setTripType: React.Dispatch<React.SetStateAction<TripType>>;
  setFlexible: React.Dispatch<React.SetStateAction<boolean>>;
};

export type SearchPanelSubmitPayload = {
  searchIntent: SearchIntent;
  originIata: string;
  destinationIata: string;
  departDate: string;
  returnDate: string;
  flexible: boolean;
  tripType: TripType;
};

export type SearchPanelProps = {
  initialOriginIata?: string;
  initialOriginDisplay?: string;
  initialDestinationIata?: string;
  initialDestinationDisplay?: string;
  initialDepartDate?: string;
  initialReturnDate?: string;
  onSubmit?: (search: SearchPanelSubmitPayload) => void;
};

export function SearchPanel({
  initialOriginIata = 'NYC',
  initialOriginDisplay = 'New York (NYC)',
  initialDestinationIata = '',
  initialDestinationDisplay = '',
  initialDepartDate = '',
  initialReturnDate = '',
  onSubmit,
}: SearchPanelProps): JSX.Element {
  // Defaults to 'hotels', not 'trip' -- matches the site's actual
  // differentiator (curated hotel-deal judgment, confirmed by tonight's
  // 5-model research and already applied to the top nav) rather than
  // presenting flights/hotels/both as three equal-weight starting points.
  const [searchIntent, setSearchIntent] = React.useState<SearchIntent>('hotels');
  const [tripType, setTripType] = React.useState<TripType>('roundtrip');
  const [origin, setOrigin] = React.useState(initialOriginIata);
  const [originDisplay, setOriginDisplay] = React.useState(initialOriginDisplay);
  const [destination, setDestination] = React.useState(initialDestinationIata);
  const [destinationDisplay, setDestinationDisplay] = React.useState(initialDestinationDisplay);
  const [departDate, setDepartDate] = React.useState(initialDepartDate);
  const [returnDate, setReturnDate] = React.useState(initialReturnDate);
  const [flexible, setFlexible] = React.useState(false);

  const handleInspirationSelect = createTripInspirationSelectionHandler({
    setOrigin,
    setOriginDisplay,
    setDestination,
    setDestinationDisplay,
    setDepartDate,
    setReturnDate,
    setTripType,
    setFlexible,
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit?.(createSearchPanelSubmitPayload({
      searchIntent,
      originIata: origin,
      destinationIata: destination,
      departDate,
      returnDate,
      flexible,
      tripType,
    }));
  }

  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-card)] sm:p-6">
      <Reveal delayMs={0}>
      <fieldset className="mb-4">
        <legend className="sr-only">Search intent</legend>
        <div className="relative grid grid-cols-3 gap-2 rounded-xl bg-[var(--bg-muted)] p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc((100%_-_1.5rem)/3)] rounded-lg border border-[var(--border-hover)] bg-[var(--brand-soft)] transition-transform duration-300"
            style={{ transform: `translateX(calc(${searchIntent === 'hotels' ? 0 : searchIntent === 'trip' ? 1 : 2} * (100% + 0.5rem)))` }}
          />
          {([
            ['hotels', 'Hotels', 'Check stays'],
            ['trip', 'Flight + hotel', 'Review both'],
            ['flights', 'Flights', 'Rank fares'],
          ] as const).map(([intent, label, description]) => (
            <button
              key={intent}
              type="button"
              onClick={() => setSearchIntent(intent)}
              aria-pressed={searchIntent === intent}
              className={`relative z-10 min-h-14 rounded-lg border border-transparent bg-transparent px-3 py-2 text-left transition-[color,transform] duration-150 active:scale-[0.97] ${
                searchIntent === intent
                  ? 'text-[var(--brand)]'
                  : 'text-[var(--text-2)] hover:text-[var(--text-1)]'
              }`}
            >
              <span className="block text-sm font-bold">{label}</span>
              <span className="mt-0.5 block text-xs font-medium">{description}</span>
            </button>
          ))}
        </div>
      </fieldset>
      </Reveal>

      <form onSubmit={handleSubmit} className="space-y-3">
        <Reveal delayMs={50}>
        <fieldset>
          <legend className="mb-2 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-3)]">
            Trip type
          </legend>
          <div className="relative grid grid-cols-2 gap-1 rounded-xl bg-[var(--bg-muted)] p-1">
            <span
              aria-hidden
              className="absolute inset-y-1 left-1 w-[calc((100%_-_0.75rem)/2)] rounded-lg border border-[var(--border-hover)] bg-[var(--brand-soft)] transition-transform duration-300"
              style={{ transform: tripType === 'roundtrip' ? 'translateX(0)' : 'translateX(calc(100% + 0.25rem))' }}
            />
            {(['roundtrip', 'oneway'] as TripType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTripType(type)}
                aria-pressed={tripType === type}
                className={`relative z-10 rounded-lg border border-transparent bg-transparent py-2 text-sm font-bold transition-[color,transform] duration-150 active:scale-[0.97] ${
                  tripType === type
                    ? 'text-[var(--brand)]'
                    : 'text-[var(--text-2)] hover:text-[var(--text-1)]'
                }`}
              >
                {type === 'roundtrip' ? 'Round trip' : 'One way'}
              </button>
            ))}
          </div>
        </fieldset>
        </Reveal>

        <Reveal delayMs={100} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-3)]">
              From
            </label>
            <AirportInput
              id="origin"
              value={origin}
              displayValue={originDisplay}
              onChange={(iata, display) => {
                setOrigin(iata);
                setOriginDisplay(display);
              }}
              placeholder="City or airport code"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-3)]">
              To
            </label>
            <AirportInput
              id="dest"
              value={destination}
              displayValue={destinationDisplay}
              onChange={(iata, display) => {
                setDestination(iata);
                setDestinationDisplay(display);
              }}
              placeholder="Anywhere"
            />
          </div>
        </Reveal>

        <Reveal delayMs={150} className={`grid gap-3 ${tripType === 'roundtrip' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <label className="block">
            <span className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-3)]">
              Depart
            </span>
            <input
              type="date"
              value={departDate}
              onChange={(event) => setDepartDate(event.target.value)}
              className="field-input"
            />
          </label>

          {tripType === 'roundtrip' && (
            <label className="block">
              <span className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-3)]">
                Return
              </span>
              <input
                type="date"
                value={returnDate}
                onChange={(event) => setReturnDate(event.target.value)}
                className="field-input"
              />
            </label>
          )}
        </Reveal>

        <Reveal delayMs={200}>
          <TripInspirationRail originIata={origin} originDisplay={originDisplay} onSelect={handleInspirationSelect} />
        </Reveal>

        <Reveal delayMs={250}>
        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={flexible}
            onChange={(event) => setFlexible(event.target.checked)}
            className="h-4 w-4 rounded border-[var(--border)] bg-[var(--bg-raised)] accent-[var(--brand)]"
          />
          <span className="text-xs font-medium text-[var(--text-2)]">
            I&apos;m flexible <span className="text-[var(--text-3)]">(+/-3 days)</span>
          </span>
        </label>
        </Reveal>

        <Reveal delayMs={300}>
        <button type="submit" className="btn-primary transition-[transform,box-shadow] duration-150 hover:shadow-[var(--shadow-lift)] active:scale-[0.98]">
          {searchIntent === 'hotels'
            ? 'Search hotels'
            : searchIntent === 'trip'
              ? 'Search flights and hotels'
              : 'Search flights'}
        </button>
        </Reveal>
      </form>
    </section>
  );
}

function formatAirportDisplay(iata: string, display?: string): string {
  return display?.trim() || iata;
}

export function createTripInspirationSelectionHandler(setters: SearchPanelSelectionSetters) {
  return function handleInspirationSelect(selection: SearchSelection) {
    setters.setOrigin(selection.originIata);
    setters.setOriginDisplay(formatAirportDisplay(selection.originIata, selection.originDisplay));
    setters.setDestination(selection.destinationIata);
    setters.setDestinationDisplay(
      formatAirportDisplay(selection.destinationIata, selection.destinationDisplay),
    );
    setters.setDepartDate(selection.departDate);
    setters.setReturnDate(selection.returnDate);
    setters.setTripType('roundtrip');
    setters.setFlexible(selection.flexible);
  };
}

export function createSearchPanelSubmitPayload(search: SearchPanelSubmitPayload) {
  return {
    ...search,
    returnDate: search.tripType === 'roundtrip' ? search.returnDate : '',
  };
}
