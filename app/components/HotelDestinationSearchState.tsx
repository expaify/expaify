'use client'

import type { ReactNode } from 'react'
import {
  hotelDestinationScopeHelper,
  hotelDestinationTypeLabel,
  type HotelDestination,
} from './HotelDestinationCombobox'

export type HotelSearchRenderableState =
  | { kind: 'selected' }
  | { kind: 'loading' }
  | { kind: 'results'; count: number; children?: ReactNode }
  | { kind: 'empty'; onEditDates: () => void; onSearchParent?: () => void }
  | { kind: 'error'; onRetry: () => void }

export function HotelDestinationScopeSummary({
  destination,
  onEditDestination,
}: {
  destination: HotelDestination
  onEditDestination: () => void
}) {
  return (
    <section className="flex min-w-0 flex-col gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 min-[640px]:flex-row min-[640px]:items-start min-[640px]:justify-between">
      <div className="min-w-0">
        <h2 className="text-h3 break-words text-[var(--text-1)]">Hotels in {destination.name}</h2>
        <p className="mt-1 break-words text-[13px] font-medium leading-5 text-[var(--text-2)]">
          {hotelDestinationScopeHelper(destination)}
        </p>
      </div>
      <button
        type="button"
        onClick={onEditDestination}
        className="btn btn-outline min-h-11 shrink-0 self-start px-5"
      >
        Edit destination
      </button>
    </section>
  )
}

export default function HotelDestinationSearchState({
  destination,
  state,
  onEditDestination,
}: {
  destination: HotelDestination
  state: HotelSearchRenderableState
  onEditDestination: () => void
}) {
  return (
    <div className="w-full min-w-0 space-y-4">
      <HotelDestinationScopeSummary
        destination={destination}
        onEditDestination={onEditDestination}
      />

      {state.kind === 'loading' ? (
        <section aria-busy="true" aria-live="polite" className="space-y-3">
          <p className="text-sm font-bold text-[var(--text-1)]">Searching hotels in {destination.name}…</p>
          <div aria-hidden="true" className="grid gap-3 min-[640px]:grid-cols-2">
            <div className="skeleton h-36 rounded-[var(--radius-card)]" />
            <div className="skeleton hidden h-36 rounded-[var(--radius-card)] min-[640px]:block" />
          </div>
        </section>
      ) : null}

      {state.kind === 'results' ? (
        <section aria-live="polite">
          <p className="mb-3 text-sm font-bold text-[var(--text-1)]">
            {state.count} hotels in {destination.name}.
          </p>
          {state.children}
        </section>
      ) : null}

      {state.kind === 'empty' ? (
        <RecoveryPanel>
          <h3 className="text-h3 text-[var(--text-1)]">
            No hotels were returned in {destination.name} for these dates.
          </h3>
          <div className="mt-5 flex flex-col items-stretch gap-2 min-[480px]:flex-row min-[480px]:items-center">
            <button type="button" onClick={state.onEditDates} className="btn btn-primary px-5">
              Edit dates
            </button>
            {destination.parent && state.onSearchParent ? (
              <button type="button" onClick={state.onSearchParent} className="btn btn-outline px-5">
                Search {destination.parent.name}
              </button>
            ) : (
              <button type="button" onClick={onEditDestination} className="btn btn-outline px-5">
                Edit destination
              </button>
            )}
          </div>
        </RecoveryPanel>
      ) : null}

      {state.kind === 'error' ? (
        <RecoveryPanel error>
          <h3 className="text-h3 text-[var(--text-1)]">
            We couldn’t search hotels in {destination.name}.
          </h3>
          <p className="mt-2 max-w-[640px] text-sm font-medium leading-6 text-[var(--text-2)]">
            Your destination and dates are still selected. Try the same search again.
          </p>
          <div className="mt-5 flex flex-col items-stretch gap-2 min-[480px]:flex-row min-[480px]:items-center">
            <button type="button" onClick={state.onRetry} className="btn btn-primary px-5">
              Try again
            </button>
            <button type="button" onClick={onEditDestination} className="btn btn-outline px-5">
              Edit destination
            </button>
          </div>
        </RecoveryPanel>
      ) : null}
    </div>
  )
}

export function UnsupportedHotelDestinationState({
  destination,
  onSearchParent,
  onEditDestination,
}: {
  destination: HotelDestination
  onSearchParent?: () => void
  onEditDestination: () => void
}) {
  const supportedParent = destination.parent && onSearchParent

  return (
    <RecoveryPanel>
      <h2 className="text-h3 break-words text-[var(--text-1)]">{destination.name}</h2>
      <p className="mt-2 max-w-[640px] break-words text-sm font-medium leading-6 text-[var(--text-2)]">
        {supportedParent
          ? `We can’t search ${destination.name} as a ${hotelDestinationTypeLabel(destination.locationType).toLocaleLowerCase()} yet. Search hotels across ${destination.parent?.name} instead?`
          : 'We don’t support that destination yet. Try a nearby city or airport.'}
      </p>
      <div className="mt-5 flex flex-col items-stretch gap-2 min-[480px]:flex-row min-[480px]:items-center">
        {supportedParent ? (
          <button type="button" onClick={onSearchParent} className="btn btn-primary px-5">
            Search {destination.parent?.name}
          </button>
        ) : null}
        <button type="button" onClick={onEditDestination} className={supportedParent ? 'btn btn-outline px-5' : 'btn btn-primary px-5'}>
          Edit destination
        </button>
      </div>
    </RecoveryPanel>
  )
}

function RecoveryPanel({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <section
      className={`rounded-[var(--radius-card)] border px-5 py-6 text-left min-[640px]:px-8 min-[640px]:py-8 ${
        error
          ? 'border-[var(--error)] bg-[var(--error-soft)]'
          : 'border-[var(--border)] bg-[var(--bg-surface)]'
      }`}
    >
      {children}
    </section>
  )
}
