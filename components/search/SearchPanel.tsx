'use client'

import * as React from 'react';
import type { FormEvent, JSX } from 'react';
import AirportInput from '@/app/components/AirportInput';
import { TripInspirationRail } from './TripInspirationRail';

type TripType = 'roundtrip' | 'oneway';

type SearchSelection = {
  originIata: string;
  destinationIata: string;
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

export type SearchPanelProps = {
  initialOriginIata?: string;
  initialOriginDisplay?: string;
  initialDestinationIata?: string;
  initialDestinationDisplay?: string;
  initialDepartDate?: string;
  initialReturnDate?: string;
  onSubmit?: (search: {
    originIata: string;
    destinationIata: string;
    departDate: string;
    returnDate: string;
    flexible: boolean;
    tripType: TripType;
  }) => void;
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
    onSubmit?.({
      originIata: origin,
      destinationIata: destination,
      departDate,
      returnDate,
      flexible,
      tripType,
    });
  }

  return (
    <section className="rounded-3xl border border-white/8 bg-[#0C1122]/85 p-4 shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:p-6">
      <div className="mb-4 flex rounded-xl bg-white/[0.04] p-1">
        {(['roundtrip', 'oneway'] as TripType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setTripType(type)}
            className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-colors ${
              tripType === type
                ? 'border-indigo-500/30 bg-indigo-500/25 text-indigo-300'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {type === 'roundtrip' ? 'Round trip' : 'One way'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
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
            <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
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
        </div>

        <div className={`grid gap-3 ${tripType === 'roundtrip' ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <label className="block">
            <span className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
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
              <span className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-[0.12em] text-gray-600">
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
        </div>

        <TripInspirationRail originIata={origin} onSelect={handleInspirationSelect} />

        <label className="flex cursor-pointer select-none items-center gap-2">
          <input
            type="checkbox"
            checked={flexible}
            onChange={(event) => setFlexible(event.target.checked)}
            className="h-4 w-4 rounded border-white/20 bg-white/5 accent-indigo-500"
          />
          <span className="text-xs font-medium text-gray-400">
            I&apos;m flexible <span className="text-gray-600">(+/-3 days)</span>
          </span>
        </label>

        <button type="submit" className="btn-primary">
          Search flights + hotels
        </button>
      </form>
    </section>
  );
}

function formatAirportDisplay(iata: string): string {
  return `${iata} (${iata})`;
}

export function createTripInspirationSelectionHandler(setters: SearchPanelSelectionSetters) {
  return function handleInspirationSelect(selection: SearchSelection) {
    setters.setOrigin(selection.originIata);
    setters.setOriginDisplay(formatAirportDisplay(selection.originIata));
    setters.setDestination(selection.destinationIata);
    setters.setDestinationDisplay(formatAirportDisplay(selection.destinationIata));
    setters.setDepartDate(selection.departDate);
    setters.setReturnDate(selection.returnDate);
    setters.setTripType('roundtrip');
    setters.setFlexible(selection.flexible);
  };
}
