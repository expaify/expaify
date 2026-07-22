'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'

export const HOTEL_DESTINATION_TYPES = [
  'city',
  'airport',
  'airport_area',
  'district',
  'neighborhood',
  'landmark',
  'region',
] as const

export type HotelDestinationType = (typeof HOTEL_DESTINATION_TYPES)[number]

export type HotelDestination = {
  provider: string
  locationId: string
  locationType: HotelDestinationType
  name: string
  parentLabel: string
  fullLabel: string
  parent?: HotelDestination
}

export type HotelDestinationLookupState =
  | 'idle'
  | 'too_short'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'error'

export interface HotelDestinationComboboxProps {
  id: string
  selectedDestination: HotelDestination | null
  suggestions: readonly HotelDestination[]
  lookupState: HotelDestinationLookupState
  minimumCharacters: number
  onQueryChange: (query: string) => void
  onSelect: (destination: HotelDestination) => void
  onClear: () => void
  onRetry: (query: string) => void
  onEditingChange?: (editing: boolean) => void
  placeholder?: string
  externalError?: string | null
  disabled?: boolean
}

const TYPE_LABELS: Record<HotelDestinationType, string> = {
  city: 'City',
  airport: 'Airport',
  airport_area: 'Airport area',
  district: 'District',
  neighborhood: 'Neighborhood',
  landmark: 'Landmark',
  region: 'Region',
}

export function hotelDestinationTypeLabel(type: HotelDestinationType) {
  return TYPE_LABELS[type]
}

export function hotelDestinationScopeHelper(destination: HotelDestination) {
  const typeLabel = hotelDestinationTypeLabel(destination.locationType)

  if (destination.locationType === 'airport_area') {
    return `Airport area near ${destination.parentLabel}`
  }

  return `${typeLabel} in ${destination.parentLabel}`
}

export function isCompleteHotelDestination(value: unknown): value is HotelDestination {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<HotelDestination>

  return (
    typeof candidate.provider === 'string' && candidate.provider.trim().length > 0 &&
    typeof candidate.locationId === 'string' && candidate.locationId.trim().length > 0 &&
    typeof candidate.locationType === 'string' &&
    HOTEL_DESTINATION_TYPES.includes(candidate.locationType as HotelDestinationType) &&
    typeof candidate.name === 'string' && candidate.name.trim().length > 0 &&
    typeof candidate.parentLabel === 'string' && candidate.parentLabel.trim().length > 0 &&
    typeof candidate.fullLabel === 'string' && candidate.fullLabel.trim().length > 0
  )
}

export function usableHotelDestinations(values: readonly HotelDestination[]) {
  const byIdentity = new Map<string, HotelDestination>()

  for (const value of values) {
    if (!isCompleteHotelDestination(value)) continue
    const identity = destinationIdentity(value)
    const existing = byIdentity.get(identity)
    if (!existing || contextLength(value) > contextLength(existing)) {
      byIdentity.set(identity, value)
    }
  }

  const candidates = [...byIdentity.values()]
  const visibleCounts = new Map<string, number>()
  for (const candidate of candidates) {
    const visibleIdentity = destinationVisibleIdentity(candidate)
    visibleCounts.set(visibleIdentity, (visibleCounts.get(visibleIdentity) ?? 0) + 1)
  }

  return candidates.filter(
    candidate => visibleCounts.get(destinationVisibleIdentity(candidate)) === 1,
  )
}

export default function HotelDestinationCombobox({
  id,
  selectedDestination,
  suggestions,
  lookupState,
  minimumCharacters,
  onQueryChange,
  onSelect,
  onClear,
  onRetry,
  onEditingChange,
  placeholder = 'Search hotel destinations',
  externalError = null,
  disabled = false,
}: HotelDestinationComboboxProps) {
  const [query, setQuery] = useState(selectedDestination?.name ?? '')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const validSuggestions = useMemo(
    () => usableHotelDestinations(suggestions),
    [suggestions],
  )
  const hasUnusablePayload = lookupState === 'ready' && validSuggestions.length === 0
  const visibleLookupState = hasUnusablePayload ? 'error' : lookupState
  const visibleQuery = editing ? query : (selectedDestination?.name ?? query)
  const safeActiveIndex = Math.min(activeIndex, Math.max(validSuggestions.length - 1, 0))
  const listboxId = `${id}-hotel-destination-listbox`
  const instructionId = `${id}-hotel-destination-instruction`
  const helperId = `${id}-hotel-destination-helper`
  const errorId = `${id}-hotel-destination-error`
  const statusId = `${id}-hotel-destination-status`
  const fieldError = externalError ?? validationError
  const activeOption = open ? validSuggestions[safeActiveIndex] : undefined
  const activeOptionId = activeOption
    ? optionId(id, activeOption)
    : undefined
  const describedBy = [
    selectedDestination && !editing ? helperId : instructionId,
    fieldError ? errorId : null,
    statusId,
  ].filter(Boolean).join(' ')

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) cancelEdit(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  })

  function setIsEditing(next: boolean) {
    setEditing(next)
    onEditingChange?.(next)
  }

  function cancelEdit(keepTypedQuery: boolean) {
    setOpen(false)
    setActiveIndex(0)
    if (selectedDestination) {
      setQuery(selectedDestination.name)
      setIsEditing(false)
    } else if (!keepTypedQuery) {
      setIsEditing(query.trim().length > 0)
    }
  }

  function beginEdit() {
    if (!selectedDestination) return
    setQuery(selectedDestination.name)
    setOpen(false)
    setValidationError(null)
    setIsEditing(true)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }

  function focusCurrentQuery() {
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }

  function handleInputChange(nextQuery: string) {
    setQuery(nextQuery)
    setValidationError(null)
    setActiveIndex(0)
    setIsEditing(true)
    setOpen(nextQuery.trim().length > 0)
    onQueryChange(nextQuery)
  }

  function selectDestination(destination: HotelDestination) {
    setQuery(destination.name)
    setOpen(false)
    setValidationError(null)
    setAnnouncement(`${destination.fullLabel} selected.`)
    setIsEditing(false)
    onSelect(destination)
  }

  function showSelectionError() {
    setValidationError('Choose a destination from the suggestions.')
    setAnnouncement('Choose a destination from the suggestions.')
    inputRef.current?.focus()
  }

  function handleClear() {
    setQuery('')
    setOpen(false)
    setActiveIndex(0)
    setValidationError(null)
    setAnnouncement('Hotel destination cleared.')
    setIsEditing(false)
    onClear()
    onQueryChange('')
    inputRef.current?.focus()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      cancelEdit(true)
      return
    }

    if (event.key === 'Tab') {
      cancelEdit(true)
      return
    }

    if (event.key === 'ArrowDown') {
      if (validSuggestions.length === 0) return
      event.preventDefault()
      setOpen(true)
      setActiveIndex(index => Math.min(index + (open ? 1 : 0), validSuggestions.length - 1))
      return
    }

    if (event.key === 'ArrowUp' && open && validSuggestions.length > 0) {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
      return
    }

    if (event.key !== 'Enter') return
    event.preventDefault()

    if (open && activeOption) {
      selectDestination(activeOption)
    } else if (!selectedDestination || editing) {
      showSelectionError()
    }
  }

  return (
    <div ref={rootRef} className="relative w-full min-w-0 space-y-2">
      <label
        htmlFor={id}
        className="block text-[12px] font-bold leading-5 text-[var(--text-1)]"
      >
        Hotel destination
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={visibleQuery}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-describedby={describedBy}
          aria-invalid={fieldError ? 'true' : 'false'}
          onChange={event => handleInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (editing && visibleQuery.trim()) setOpen(true)
          }}
          className={`min-h-[3.25rem] w-full rounded-[var(--radius-control)] border bg-[var(--bg-raised)] px-4 py-3 pr-12 text-[0.9375rem] font-medium text-[var(--text-1)] transition-[border-color,background] placeholder:text-[var(--text-3)] focus:outline-none focus:ring-0 ${
            fieldError
              ? 'border-[var(--error)] bg-[var(--error-soft)] focus:border-[var(--error)]'
              : 'border-[var(--border-strong)] focus:border-[var(--border-focus)]'
          }`}
        />

        {visibleQuery && !disabled ? (
          <button
            type="button"
            aria-label="Clear hotel destination"
            onClick={handleClear}
            className="absolute right-1 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full text-xl leading-none text-[var(--text-2)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-1)]"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </div>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Hotel destination suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(20rem,50vh)] overflow-y-auto overscroll-contain rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--bg-raised)] p-1.5 shadow-[var(--shadow-lift)]"
        >
          {visibleLookupState === 'ready' && validSuggestions.length > 0
            ? validSuggestions.map((destination, index) => (
                <div
                  id={optionId(id, destination)}
                  key={destinationIdentity(destination)}
                  role="option"
                  aria-label={destination.fullLabel}
                  aria-selected={index === safeActiveIndex}
                  onPointerEnter={() => setActiveIndex(index)}
                  onPointerDown={event => {
                    event.preventDefault()
                    selectDestination(destination)
                  }}
                  className={`flex min-h-16 w-full cursor-pointer flex-col justify-center rounded-[var(--radius-control)] px-3 py-2.5 text-left hover:bg-[var(--bg-muted)] ${
                    index === safeActiveIndex
                      ? 'bg-[var(--brand-soft)] shadow-[inset_0_0_0_1px_var(--border-hover)]'
                      : ''
                  }`}
                >
                  <span className="block break-words text-sm font-bold leading-5 text-[var(--text-1)]">
                    {destination.name}
                  </span>
                  <span className="mt-0.5 block break-words text-xs font-medium leading-5 text-[var(--text-2)]">
                    {hotelDestinationTypeLabel(destination.locationType)} · {destination.parentLabel}
                  </span>
                </div>
              ))
            : <LookupMessage
                state={visibleLookupState}
                query={visibleQuery}
                minimumCharacters={minimumCharacters}
                canCancelToSelection={Boolean(selectedDestination)}
                onRetry={() => onRetry(visibleQuery)}
                onEdit={focusCurrentQuery}
              />}
        </div>
      ) : null}

      {selectedDestination && !editing ? (
        <div id={helperId} className="flex items-start justify-between gap-3">
          <p className="min-w-0 break-words text-xs font-bold leading-5 text-[var(--success)]">
            {hotelDestinationScopeHelper(selectedDestination)}
          </p>
          <button
            type="button"
            onClick={beginEdit}
            className="inline-flex min-h-11 shrink-0 items-center text-xs font-bold text-[var(--brand)] underline-offset-4 hover:underline"
          >
            Edit destination
          </button>
        </div>
      ) : (
        <p id={instructionId} className="text-xs font-medium leading-5 text-[var(--text-2)]">
          Choose a suggestion to set the hotel search area.
        </p>
      )}

      {fieldError ? (
        <p id={errorId} role="alert" className="text-xs font-bold leading-5 text-[var(--error)]">
          {fieldError}
        </p>
      ) : null}

      <div id={statusId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {lookupAnnouncement({
          open,
          state: visibleLookupState,
          query: visibleQuery,
          minimumCharacters,
          resultCount: validSuggestions.length,
          fallback: announcement,
        })}
      </div>
    </div>
  )
}

function LookupMessage({
  state,
  query,
  minimumCharacters,
  canCancelToSelection,
  onRetry,
  onEdit,
}: {
  state: HotelDestinationLookupState
  query: string
  minimumCharacters: number
  canCancelToSelection: boolean
  onRetry: () => void
  onEdit: () => void
}) {
  if (state === 'too_short' || state === 'idle') {
    return (
      <p className="px-4 py-3 text-sm font-medium text-[var(--text-2)]">
        Type at least {minimumCharacters} characters to search destinations.
      </p>
    )
  }

  if (state === 'loading') {
    return (
      <p className="px-4 py-3 text-sm font-medium text-[var(--text-2)]">
        Searching destinations…
      </p>
    )
  }

  if (state === 'empty') {
    return (
      <div className="px-4 py-3">
        <p className="break-words text-sm font-bold text-[var(--text-1)]">
          No destinations found for “{query}”.
        </p>
        <p className="mt-1 text-xs font-medium leading-5 text-[var(--text-2)]">
          Check the spelling or try a nearby city or airport.
        </p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="rounded-[var(--radius-control)] bg-[var(--error-soft)] px-4 py-3" role="alert">
        <p className="text-sm font-bold leading-5 text-[var(--text-1)]">
          Destination search is unavailable right now. Try again.
        </p>
        <div className="mt-3 flex flex-col items-stretch gap-2 min-[480px]:flex-row">
          <button type="button" onClick={onRetry} className="btn btn-primary px-5">
            Try again
          </button>
          {canCancelToSelection ? (
            <button type="button" onClick={onEdit} className="btn btn-outline px-5">
              Edit destination
            </button>
          ) : null}
        </div>
      </div>
    )
  }

  return null
}

function destinationIdentity(destination: HotelDestination) {
  return `${destination.provider}\u0000${destination.locationType}\u0000${destination.locationId}`
}

function destinationVisibleIdentity(destination: HotelDestination) {
  return `${destination.name.trim().toLocaleLowerCase()}\u0000${destination.locationType}\u0000${destination.parentLabel.trim().toLocaleLowerCase()}`
}

function contextLength(destination: HotelDestination) {
  return destination.parentLabel.length + destination.fullLabel.length
}

function lookupAnnouncement({
  open,
  state,
  query,
  minimumCharacters,
  resultCount,
  fallback,
}: {
  open: boolean
  state: HotelDestinationLookupState
  query: string
  minimumCharacters: number
  resultCount: number
  fallback: string
}) {
  if (!open) return fallback
  if (state === 'loading') return 'Searching destinations.'
  if (state === 'too_short' || state === 'idle') {
    return `Type at least ${minimumCharacters} characters to search destinations.`
  }
  if (state === 'ready' && resultCount > 0) {
    return `${resultCount} destinations found. Use the up and down arrow keys to review.`
  }
  if (state === 'empty') {
    return `No destinations found for “${query}”. Check the spelling or try a nearby city or airport.`
  }
  return fallback
}

function optionId(fieldId: string, destination: HotelDestination) {
  const safeKey = `${destination.provider}-${destination.locationType}-${destination.locationId}`
    .replace(/[^a-zA-Z0-9_-]/g, '-')
  return `${fieldId}-hotel-destination-option-${safeKey}`
}
