import type { ReactElement } from 'react'

const stateSlots: unknown[] = []
const refSlots: Array<{ current: unknown }> = []
let stateCursor = 0
let refCursor = 0
let idCursor = 0
const push = jest.fn()

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react')
  return {
    ...actual,
    useState: jest.fn((initial: unknown) => {
      const index = stateCursor++
      if (!(index in stateSlots)) stateSlots[index] = typeof initial === 'function' ? (initial as () => unknown)() : initial
      return [stateSlots[index], (value: unknown) => {
        stateSlots[index] = typeof value === 'function' ? (value as (current: unknown) => unknown)(stateSlots[index]) : value
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
    useMemo: jest.fn((factory: () => unknown) => factory()),
    useId: jest.fn(() => `test-id-${idCursor++}`),
  }
})

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: jest.fn() }),
}))
jest.mock('@/lib/analytics', () => ({ track: jest.fn() }))

const { HotelDealCriteriaSummary } = jest.requireActual('../HotelDealCriteria') as typeof import('../HotelDealCriteria')
const { HotelSearchCriteriaEditor } = jest.requireActual('../HotelSearchCriteria') as typeof import('../HotelSearchCriteria')

const criteria = {
  schemaVersion: 1 as const,
  criteriaVersion: 'criteria_active',
  destination: { state: 'selected' as const, city: 'Miami' },
  dates: { semantic: 'missing' as const },
  occupancy: { state: 'not_captured' as const },
  source: 'restored' as const,
}

function renderSummary(backHref = '/deals?criteriaVersion=criteria_active') {
  stateCursor = 0
  refCursor = 0
  return HotelDealCriteriaSummary({
    context: { criteria, status: 'matched', backHref },
    deal: { city: 'Miami' },
  })
}

function walk(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (!node || typeof node !== 'object') return []
  const element = node as ReactElement<Record<string, unknown>>
  const children = element.props?.children
  const childList = Array.isArray(children) ? children : [children]
  return [element, ...childList.flatMap(walk)]
}

describe('HotelDealCriteriaSummary failed edit recovery', () => {
  beforeEach(() => {
    stateSlots.length = 0
    refSlots.length = 0
    idCursor = 0
    push.mockClear()
    Object.defineProperty(global, 'fetch', { configurable: true, value: jest.fn() })
    Object.defineProperty(global, 'window', {
      configurable: true,
      value: { requestAnimationFrame: (callback: () => void) => callback() },
    })
    Object.defineProperty(global, 'HTMLElement', { configurable: true, value: class HTMLElement {} })
    Object.defineProperty(global, 'document', {
      configurable: true,
      value: { activeElement: null, addEventListener: jest.fn(), removeEventListener: jest.fn() },
    })
  })

  it('retains the failed draft for Edit and retries the same versioned request', async () => {
    const failedDraft = { city: 'Paris', dateFrom: '2026-09-10', dateTo: '2026-09-13' }
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockRejectedValueOnce(new Error('offline'))

    let tree = renderSummary()
    let editor = walk(tree).find(element => element.type === HotelSearchCriteriaEditor)
    expect(editor).toBeDefined()
    ;(editor!.props.onSubmit as (draft: typeof failedDraft) => void)(failedDraft)
    await Promise.resolve()
    await Promise.resolve()

    tree = renderSummary()
    editor = walk(tree).find(element => element.type === HotelSearchCriteriaEditor)
    expect(editor?.props.initialDraft).toEqual(failedDraft)
    const retry = walk(tree).find(element => element.type === 'button' && element.props.children === 'Retry update')
    expect(retry).toBeDefined()

    const failedVersion = new URL(String(fetchMock.mock.calls[0][0]), 'https://expaify.test').searchParams.get('criteriaVersion')
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ criteriaVersion: failedVersion, deals: [], total: 0 }),
    })
    ;(retry!.props.onClick as () => void)()
    await Promise.resolve()
    await Promise.resolve()

    const secondRequest = String(fetchMock.mock.calls[1][0])
    const secondVersion = new URL(secondRequest, 'https://expaify.test').searchParams.get('criteriaVersion')
    expect(secondVersion).toBe(failedVersion)
    expect(secondRequest).toContain('city=Paris')
    expect(push).toHaveBeenCalled()
  })

  it('reinitializes the editor fields from a failed draft when it reopens', () => {
    const failedDraft = { city: 'Paris', dateFrom: '2026-09-10', dateTo: '2026-09-13' }
    const baseProps = {
      criteria,
      cities: ['Miami', 'Paris'],
      surface: 'detail' as const,
      onClose: jest.fn(),
      onSubmit: jest.fn(),
    }

    stateCursor = 0
    refCursor = 0
    HotelSearchCriteriaEditor({ ...baseProps, open: false })
    stateCursor = 0
    refCursor = 0
    HotelSearchCriteriaEditor({ ...baseProps, open: true, initialDraft: failedDraft })
    stateCursor = 0
    refCursor = 0
    const reopened = HotelSearchCriteriaEditor({ ...baseProps, open: true, initialDraft: failedDraft })
    const fields = walk(reopened).filter(element => element.type === 'select' || element.type === 'input')

    expect(fields.map(field => field.props.value)).toEqual(['Paris', '2026-09-10', '2026-09-13'])
  })

  it('leaves a destination-page origin for canonical deals when the destination changes', async () => {
    const tree = renderSummary('/destinations/miami?criteriaReturn=destination&criteriaVersion=criteria_active')
    const editor = walk(tree).find(element => element.type === HotelSearchCriteriaEditor)
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (input: string) => ({
      ok: true,
      json: async () => ({
        criteriaVersion: new URL(input, 'https://expaify.test').searchParams.get('criteriaVersion'),
        deals: [],
        total: 0,
      }),
    }))

    ;(editor!.props.onSubmit as (draft: { city: string; dateFrom: string; dateTo: string }) => void)({
      city: 'Paris',
      dateFrom: '',
      dateTo: '',
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/deals\?/))
    expect(push).not.toHaveBeenCalledWith(expect.stringContaining('/destinations/paris'))
  })

  it('keeps the exact destination-page origin when only dates change', async () => {
    const tree = renderSummary('/destinations/miami?criteriaSchema=1&criteriaVersion=criteria_active&criteriaSource=restored&criteriaReturn=destination&city=Miami&min_discount=30&sort=price')
    const editor = walk(tree).find(element => element.type === HotelSearchCriteriaEditor)
    const fetchMock = global.fetch as jest.Mock
    fetchMock.mockImplementation(async (input: string) => ({
      ok: true,
      json: async () => ({
        criteriaVersion: new URL(input, 'https://expaify.test').searchParams.get('criteriaVersion'),
        deals: [],
        total: 0,
      }),
    }))

    ;(editor!.props.onSubmit as (draft: { city: string; dateFrom: string; dateTo: string }) => void)({
      city: 'Miami',
      dateFrom: '2026-10-01',
      dateTo: '',
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(push).toHaveBeenCalledWith(expect.stringMatching(/^\/destinations\/miami\?/))
    expect(push).toHaveBeenCalledWith(expect.stringContaining('criteriaReturn=destination'))
  })
})
