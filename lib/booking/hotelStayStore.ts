// Client-only durability for a traveler's self-declared hotel booking.
//
// expaify never observes a hotel reservation. This store holds only what
// expaify itself showed (offer, rate, hotel identity) plus the traveler's
// own declaration that they booked. It never talks to a server, never
// creates a bookings table, and never extends the pre-handoff Redis
// context store's 30-minute TTL. See
// docs/pipeline/hotel-booking-confirmation/03-design.md section 4.

export const HOTEL_STAY_STORE_KEY = 'expaify.hotelStay.v1'
export const HOTEL_STAY_STORE_LIMIT = 10
export const HOTEL_STAY_RETENTION_DAYS = 180

export type HotelStayStub = {
  v: 1
  offerId: string
  provider: string
  partnerHost: string
  /** '' when the partner could not be confidently named. */
  partnerLabel: string
  name: string
  /** '' when no area/location label was available. */
  areaLabel: string
  /** The rate expaify showed — never presented as the amount paid. */
  priceCents: number
  currency: string
  priceBasis: 'per_night_before_taxes_fees'
  providerUrl: string
  /** ISO 8601, expaify's clock, when the traveler declared "I booked". */
  declaredBookedAt: string
  handoffAttemptId: string
  checkIn?: string
  checkOut?: string
  nightCount?: number
}

type WriteResult = { ok: true } | { ok: false; reason: string }

const PROBE_KEY = '__expaify_storage_probe__'
const RETENTION_MS = HOTEL_STAY_RETENTION_DAYS * 24 * 60 * 60 * 1000

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function isStayStorageAvailable(): boolean {
  if (!hasLocalStorage()) return false
  try {
    window.localStorage.setItem(PROBE_KEY, '1')
    window.localStorage.removeItem(PROBE_KEY)
    return true
  } catch {
    return false
  }
}

function isValidStub(value: unknown): value is HotelStayStub {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>

  if (v.v !== 1) return false
  if (typeof v.offerId !== 'string' || v.offerId.length === 0) return false
  if (typeof v.provider !== 'string') return false
  if (typeof v.partnerHost !== 'string') return false
  if (typeof v.partnerLabel !== 'string') return false
  if (typeof v.name !== 'string') return false
  if (typeof v.areaLabel !== 'string') return false
  if (typeof v.priceCents !== 'number' || !Number.isInteger(v.priceCents)) return false
  if (typeof v.currency !== 'string' || !/^[A-Z]{3}$/.test(v.currency)) return false
  if (v.priceBasis !== 'per_night_before_taxes_fees') return false
  if (typeof v.providerUrl !== 'string') return false
  if (typeof v.declaredBookedAt !== 'string' || Number.isNaN(Date.parse(v.declaredBookedAt))) return false
  if (typeof v.handoffAttemptId !== 'string') return false
  if (v.checkIn !== undefined && typeof v.checkIn !== 'string') return false
  if (v.checkOut !== undefined && typeof v.checkOut !== 'string') return false
  if (v.nightCount !== undefined && typeof v.nightCount !== 'number') return false

  return true
}

/**
 * Reads the raw list from storage. Returns `null` when the value is absent
 * for any reason expaify should treat as "no store" — including corrupt or
 * foreign data, which is silently discarded rather than surfaced as an
 * error to the traveler. Never throws.
 */
function loadList(): HotelStayStub[] | null {
  if (!hasLocalStorage()) return null
  try {
    const raw = window.localStorage.getItem(HOTEL_STAY_STORE_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    const stubs: HotelStayStub[] = []
    for (const item of parsed) {
      if (!isValidStub(item)) return null
      stubs.push(item)
    }
    return stubs
  } catch {
    return null
  }
}

function isExpired(stub: HotelStayStub, now: number): boolean {
  const anchorSource = stub.checkOut ?? stub.declaredBookedAt
  const anchor = Date.parse(anchorSource)
  if (Number.isNaN(anchor)) return true
  return now > anchor + RETENTION_MS
}

function persistList(stubs: readonly HotelStayStub[]): WriteResult {
  if (!hasLocalStorage()) return { ok: false, reason: 'Storage is not available in this environment.' }
  try {
    window.localStorage.setItem(HOTEL_STAY_STORE_KEY, JSON.stringify(stubs))
    return { ok: true }
  } catch {
    return { ok: false, reason: 'Storage write failed.' }
  }
}

/** Prunes expired stubs, silently persisting the pruned list when it changed. */
function freshList(): HotelStayStub[] {
  const list = loadList()
  if (!list) return []
  const now = Date.now()
  const fresh = list.filter(stub => !isExpired(stub, now))
  if (fresh.length !== list.length) persistList(fresh)
  return fresh
}

export function readStayStub(offerId: string): HotelStayStub | null {
  if (!offerId) return null
  return freshList().find(stub => stub.offerId === offerId) ?? null
}

/**
 * Writes a stub, capped at {@link HOTEL_STAY_STORE_LIMIT}. A write for an
 * `offerId` already present replaces it in place without evicting. A write
 * that would exceed the cap for a new `offerId` evicts exactly the single
 * oldest stub by `declaredBookedAt`. Never throws.
 */
export function writeStayStub(stub: HotelStayStub): WriteResult {
  const existing = freshList()
  const withoutCurrent = existing.filter(item => item.offerId !== stub.offerId)
  const isNewOffer = withoutCurrent.length === existing.length

  let next: HotelStayStub[]
  if (isNewOffer && existing.length >= HOTEL_STAY_STORE_LIMIT) {
    const sortedByAge = [...existing].sort((a, b) => Date.parse(a.declaredBookedAt) - Date.parse(b.declaredBookedAt))
    next = [...sortedByAge.slice(1), stub]
  } else {
    next = [...withoutCurrent, stub]
  }

  return persistList(next)
}

// --- React `useSyncExternalStore` integration ---------------------------
//
// localStorage is an external, mutable data source. Reading it directly
// during render (or stashing it in a ref and mutating that ref to force a
// re-render) is unsafe under React's rules — refs must not be read during
// render, and a component must not assume its own render is the only thing
// that changes the store (another tab can write the same key). React's
// prescribed tool for exactly this is `useSyncExternalStore`, which callers
// in app/book/BookingFlow.tsx use as:
//
//   useSyncExternalStore(subscribeToStayStoreChanges, () => getStayStubSnapshot(offerId), () => null)
//
// `getStayStubSnapshot` must return a referentially stable value when
// nothing has changed (React compares snapshots with `Object.is` and will
// loop otherwise), so it caches the last parsed stub per offerId against
// the raw string currently in storage and only reparses when that string
// changes.
const snapshotCache = new Map<string, { raw: string | null; stub: HotelStayStub | null }>()

function currentRawStore(): string | null {
  return hasLocalStorage() ? window.localStorage.getItem(HOTEL_STAY_STORE_KEY) : null
}

export function getStayStubSnapshot(offerId: string): HotelStayStub | null {
  const raw = currentRawStore()
  const cached = snapshotCache.get(offerId)
  if (cached && cached.raw === raw) return cached.stub

  const stub = readStayStub(offerId)
  // Re-read the raw value: `readStayStub` may itself have pruned and
  // rewritten the store, and the cache should key off the value that is
  // actually settled in storage now, not the pre-prune value.
  snapshotCache.set(offerId, { raw: currentRawStore(), stub })
  return stub
}

/**
 * Notifies `useSyncExternalStore` subscribers of changes made by *other*
 * browser tabs/windows to this store (the native `storage` event never
 * fires for writes made by the current document). Writes made by this tab
 * are already followed by a same-component state update in every caller
 * (e.g. the traveler's own "I booked" declaration), which is sufficient to
 * make React re-read the snapshot on its own.
 */
export function subscribeToStayStoreChanges(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handleStorageEvent = (event: StorageEvent) => {
    if (event.key === null || event.key === HOTEL_STAY_STORE_KEY) onChange()
  }
  window.addEventListener('storage', handleStorageEvent)
  return () => window.removeEventListener('storage', handleStorageEvent)
}
