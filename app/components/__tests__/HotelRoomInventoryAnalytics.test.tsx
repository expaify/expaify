import type { ReactElement } from 'react'

const trackMock = jest.fn()
const stateSlots: unknown[] = []
const refSlots: Array<{ current: unknown }> = []
let stateCursor = 0
let refCursor = 0
let visibilityListener: (() => void) | undefined

jest.mock('@/lib/analytics', () => ({ track: (...args: unknown[]) => trackMock(...args) }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return {
    ...actual,
    useState: jest.fn((initial: unknown) => {
      const index = stateCursor++
      if (!(index in stateSlots)) stateSlots[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
      return [stateSlots[index], (value: unknown) => {
        stateSlots[index] = typeof value === 'function'
          ? (value as (current: unknown) => unknown)(stateSlots[index])
          : value
      }]
    }),
    useRef: jest.fn((initial: unknown) => {
      const index = refCursor++
      if (!(index in refSlots)) refSlots[index] = { current: initial }
      return refSlots[index]
    }),
    useEffect: jest.fn((effect: () => void | (() => void)) => {
      effect()
    }),
  }
})

const { HotelDealCriteriaHandoff } = jest.requireActual('../HotelDealCriteria') as typeof import('../HotelDealCriteria')
const { CompareRow } = jest.requireActual('../ui/CompareRow') as typeof import('../ui/CompareRow')

type TestElement = ReactElement<Record<string, unknown>>

function walk(node: unknown): TestElement[] {
  if (!node || typeof node !== 'object') return []
  const element = node as TestElement
  const children = element.props?.children
  const childList = Array.isArray(children) ? children : [children]
  return [element, ...childList.flatMap(walk)]
}

function textContent(node: unknown): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (!node || typeof node !== 'object') return ''
  const children = (node as TestElement).props?.children
  return (Array.isArray(children) ? children : [children]).map(textContent).join('')
}

const criteria = {
  schemaVersion: 1 as const,
  criteriaVersion: 'criteria_123',
  destination: { state: 'selected' as const, city: 'Paris' },
  dates: { semantic: 'checkin_window' as const, dateFrom: '2026-08-01', dateTo: '2026-08-03' },
  occupancy: { state: 'not_captured' as const },
  source: 'restored' as const,
}

function renderHandoff() {
  stateCursor = 0
  refCursor = 0
  return HotelDealCriteriaHandoff({
    context: { criteria, status: 'matched', backHref: '/deals?criteriaVersion=criteria_123' },
    deal: { id: 'deal_123', city: 'Paris', checkInDate: '2026-08-01' },
    links: { booking: 'https://www.booking.com/hotel/example?aid=affiliate' },
    hotelName: 'Test hotel',
  })
}

describe('hotel room handoff recovery analytics lifecycle', () => {
  const firstSessionId = '11111111-1111-4111-8111-111111111111'
  const restartedSessionId = '22222222-2222-4222-8222-222222222222'
  const storage = new Map<string, string>()
  const originalCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  let visibilityState: DocumentVisibilityState

  beforeEach(() => {
    stateSlots.length = 0
    refSlots.length = 0
    trackMock.mockClear()
    storage.clear()
    visibilityState = 'visible'
    visibilityListener = undefined
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { randomUUID: jest.fn().mockReturnValueOnce(firstSessionId).mockReturnValueOnce(restartedSessionId) },
    })
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        innerWidth: 1280,
        sessionStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    })
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        get visibilityState() { return visibilityState },
        addEventListener: jest.fn((event: string, listener: () => void) => {
          if (event === 'visibilitychange') visibilityListener = listener
        }),
        removeEventListener: jest.fn(),
      },
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalCrypto) Object.defineProperty(globalThis, 'crypto', originalCrypto)
    else delete (globalThis as { crypto?: unknown }).crypto
    delete (globalThis as { window?: unknown }).window
    delete (globalThis as { document?: unknown }).document
  })

  it('joins start, return, recovery view, action, and restart with prior and new opaque IDs', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(16_000)
    let tree = renderHandoff()
    const compare = walk(tree).find(element => element.type === CompareRow)

    expect(compare).toBeDefined()
    ;(compare!.props.onProviderOpen as (provider: 'booking') => void)('booking')

    expect(trackMock).toHaveBeenCalledWith('hotel_room_handoff_started', expect.objectContaining({
      handoff_session_id: firstSessionId,
      provider: 'booking',
      deal_id: 'deal_123',
      criteria_version: 'criteria_123',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    }))

    visibilityState = 'hidden'
    visibilityListener?.()
    visibilityState = 'visible'
    visibilityListener?.()

    expect(trackMock).toHaveBeenCalledWith('hotel_room_handoff_returned', {
      handoff_session_id: firstSessionId,
      provider: 'booking',
      deal_id: 'deal_123',
      away_duration_bucket: '10s_59s',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    })
    expect(trackMock).toHaveBeenCalledWith('hotel_room_recovery_viewed', {
      handoff_session_id: firstSessionId,
      deal_id: 'deal_123',
      context_restoration_status: 'restorable',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    })

    tree = renderHandoff()
    const recheck = walk(tree).find(element => element.type === 'a' && textContent(element) === 'Check rooms again')
    expect(recheck).toBeDefined()
    ;(recheck!.props.onClick as (event: { preventDefault: () => void }) => void)({ preventDefault: jest.fn() })

    expect(trackMock).toHaveBeenCalledWith('hotel_room_recovery_action', {
      handoff_session_id: firstSessionId,
      deal_id: 'deal_123',
      action: 'recheck_same_hotel',
      context_restoration_status: 'restorable',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    })
    expect(trackMock).toHaveBeenCalledWith('hotel_room_handoff_restarted', {
      prior_handoff_session_id: firstSessionId,
      handoff_session_id: restartedSessionId,
      provider: 'booking',
      deal_id: 'deal_123',
      recovery_action: 'recheck_same_hotel',
      context_restoration_status: 'restorable',
      inventory_evidence_state: 'not_checked',
      alternative_state: 'not_checked',
    })

    const lifecycleEvents = trackMock.mock.calls
      .map(([event]) => event)
      .filter(event => String(event).startsWith('hotel_room_'))
    expect(lifecycleEvents).toEqual([
      'hotel_room_handoff_started',
      'hotel_room_handoff_returned',
      'hotel_room_recovery_viewed',
      'hotel_room_recovery_action',
      'hotel_room_handoff_restarted',
    ])
    now.mockRestore()
  })
})
