import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import HotelLuggageStorageResearchPage, { metadata } from '@/app/research/hotel-luggage-storage/page'
import { HotelLuggageStorageHarness } from '../HotelLuggageStorageHarness'
import { HotelLuggageStoragePrototype } from '../HotelLuggageStoragePrototype'
import {
  createLuggageStorageFixture,
  evidenceForSurface,
  LUGGAGE_STORAGE_FIXTURE_IDS,
  type LuggageStorageFixtureId,
  type PrototypeLuggageStorageEvidence,
} from '../hotelLuggageStorageFixtures'

const EXPECTED_STATE_COPY: Record<LuggageStorageFixtureId, string> = {
  'complete-included': 'Storage is reported for both timing periods',
  'complete-paid': 'Storage is reported for both timing periods',
  'partial-before': 'Some storage details are not specified',
  'partial-after': 'Some storage details are not specified',
  'before-unavailable': 'Storage is not reported for every timing period',
  'after-unavailable': 'Storage is not reported for every timing period',
  'service-unavailable': 'The property reports no luggage storage',
  'conflicting-timing': 'Storage details conflict — verify before booking',
  'not-returned': 'Luggage-storage details were not provided',
  loading: 'Checking luggage-storage details',
  error: 'Luggage-storage details could not be checked',
  'revision-mismatch': 'Some storage details are not specified',
}

function renderFixture(id: LuggageStorageFixtureId, surface: 'detail' | 'handoff') {
  return renderToStaticMarkup(
    <HotelLuggageStoragePrototype
      evidence={evidenceForSurface(id, surface)}
      hotelId={`synthetic-${id}`}
      surface={surface}
    />,
  )
}

describe('HotelLuggageStoragePrototype rendered validation surfaces', () => {
  it.each(LUGGAGE_STORAGE_FIXTURE_IDS)('renders %s independently in expanded detail', id => {
    const html = renderFixture(id, 'detail')

    expect(html).toContain('Luggage storage')
    expect(html).toContain(EXPECTED_STATE_COPY[id])
    expect(html).toContain('Research prototype — luggage storage is not part of hotel ranking or Deal Score.')
    expect(html).toContain(`id="synthetic-${id}-detail-luggage-storage"`)
    expect(html).toContain('Property-reported information; it does not guarantee storage')
  })

  it.each(LUGGAGE_STORAGE_FIXTURE_IDS)('renders %s independently in outbound review', id => {
    const html = renderFixture(id, 'handoff')
    const expected = id === 'revision-mismatch'
      ? 'Luggage-storage details could not be checked'
      : EXPECTED_STATE_COPY[id]

    expect(html).toContain(expected)
    expect(html).toContain('Same property-reported information shown in hotel details.')
    expect(html).toContain(`id="synthetic-${id}-handoff-luggage-storage"`)
    expect(html).toContain(`Evidence revision: ${evidenceForSurface(id, 'handoff').evidenceRevision}`)
  })

  it('keeps period, charge, missing-data, and conflict meanings explicit', () => {
    expect(renderFixture('partial-before', 'detail')).toContain('After checkout</dt><dd class="break-words text-[color:var(--text-2)]">Not specified by this provider.')
    expect(renderFixture('before-unavailable', 'detail')).toContain('Reported unavailable by the property.')
    expect(renderFixture('service-unavailable', 'detail')).toContain('Not applicable because the property reports no luggage storage.')
    expect(renderFixture('complete-paid', 'detail')).toContain('A charge of $12.00 per bag is reported.')

    const empty = renderFixture('not-returned', 'detail')
    expect(empty).toContain('Before check-in</dt><dd class="break-words text-[color:var(--text-2)]">Not provided.')
    expect(empty).not.toContain('Reported unavailable by the property.')

    const conflict = renderFixture('conflicting-timing', 'detail')
    expect(conflict).toContain('Synthetic property policy:')
    expect(conflict).toContain('Synthetic provider listing:')
    expect(conflict).toContain('We are not choosing one statement as current.')
  })

  it('renders required supplemental unknowns for incomplete evidence', () => {
    for (const id of ['partial-before', 'conflicting-timing', 'not-returned'] as const) {
      const html = renderFixture(id, 'detail')
      expect(html).toContain('Reported hours: </span>Not specified by this provider.')
      expect(html).toContain('Reported conditions: </span>Not specified by this provider.')
    }
  })

  it('falls back safely for malformed paid money and never presents it as included', () => {
    const evidence: PrototypeLuggageStorageEvidence = {
      ...createLuggageStorageFixture('complete-paid'),
      charge: { state: 'paid', amount: { priceCents: 1200, currency: 'ZZZ' } },
    }
    const html = renderToStaticMarkup(
      <HotelLuggageStoragePrototype evidence={evidence} hotelId="malformed-money" surface="detail" />,
    )

    expect(html).toContain('A storage charge is reported; the amount and basis were not provided.')
    expect(html).not.toContain('ZZZ')
    expect(html).not.toContain('No storage charge reported')
  })

  it('uses non-blocking loading and error semantics with a 44px retry target', () => {
    const loading = renderFixture('loading', 'handoff')
    const error = renderFixture('error', 'handoff')

    expect(loading).toContain('aria-busy="true"')
    expect(loading).toContain('role="status"')
    expect(loading).toContain('aria-live="polite"')
    expect(loading).toContain('aria-hidden="true"')
    expect(error).toContain('role="status"')
    expect(error).toContain('tabindex="-1"')
    expect(error).toContain('Try storage check again')
    expect(error).toContain('btn btn-outline btn-sm')
    expect(error).toContain('w-full sm:w-auto')
  })

  it('keeps mobile rows stacked, desktop rows paired, and long values wrap-safe', () => {
    const html = renderFixture('complete-included', 'handoff')

    expect(html).toContain('grid grid-cols-1')
    expect(html).toContain('sm:grid-cols-2')
    expect(html).toContain('sm:col-span-2')
    expect(html).toContain('min-w-0')
    expect(html).toContain('break-words')
  })
})

describe('/research/hotel-luggage-storage route and isolation', () => {
  it('renders the research route with all controls and the correct continuity order', () => {
    const html = renderToStaticMarkup(<HotelLuggageStorageResearchPage />)
    const ownershipIndex = html.indexOf('Who handles my booking?')
    const loyaltyIndex = html.indexOf('Will this stay earn points or status?')
    const storageIndex = html.indexOf('Same property-reported information shown in hotel details.')
    const outboundIndex = html.indexOf('Check rooms at Research Rooms')

    expect(html).toContain('Hotel luggage-storage confidence')
    expect((html.match(/<option/g) ?? [])).toHaveLength(42)
    expect(ownershipIndex).toBeGreaterThan(-1)
    expect(loyaltyIndex).toBeGreaterThan(ownershipIndex)
    expect(storageIndex).toBeGreaterThan(loyaltyIndex)
    expect(outboundIndex).toBeGreaterThan(storageIndex)
    expect(html).toContain('min-[1000px]:grid-cols-2')
    expect(html).toContain('min-h-11 w-full')
    expect(html).not.toMatch(/<form|<textarea|type="email"/)
  })

  it('keeps the page out of search indexing', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(HotelLuggageStorageResearchPage()).toEqual(expect.objectContaining({ type: HotelLuggageStorageHarness }))
  })

  it('does not wire luggage-storage evidence into production contracts or surfaces', () => {
    const root = process.cwd()
    const productionFiles = [
      'app/components/HotelCard.tsx',
      'app/components/HotelDecisionAnalytics.tsx',
      'app/book/BookingFlow.tsx',
      'app/api/book/hotel-context/route.ts',
      'lib/types.ts',
      ...readdirSync(join(root, 'lib/providers'))
        .filter(file => file.endsWith('.ts'))
        .map(file => `lib/providers/${file}`),
    ]
    const productionSource = productionFiles
      .map(file => readFileSync(join(root, file), 'utf8'))
      .join('\n')

    expect(productionSource).not.toMatch(/luggage[- ]storage|research-storage/i)
  })
})

describe('HotelLuggageStoragePrototype retry interaction', () => {
  let container: HTMLDivElement
  let root: import('react-dom/client').Root

  beforeAll(() => {
    const { parseHTML } = require('linkedom') as {
      parseHTML: (html: string) => { window: Window }
    }
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
    const domWindow = window as unknown as typeof globalThis
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://expaify.test/research/hotel-luggage-storage'),
    })
    Object.assign(globalThis, {
      window,
      document: window.document,
      navigator: window.navigator,
      HTMLElement: domWindow.HTMLElement,
      Node: domWindow.Node,
      Event: domWindow.Event,
      MouseEvent: domWindow.MouseEvent,
      IS_REACT_ACT_ENVIRONMENT: true,
    })
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0),
    })
  })

  beforeEach(() => {
    jest.useFakeTimers()
    document.body.innerHTML = '<div id="root"></div>'
    container = document.querySelector('#root') as HTMLDivElement
    const { createRoot } = require('react-dom/client') as typeof import('react-dom/client')
    root = createRoot(container)
  })

  afterEach(async () => {
    const { act } = require('react') as typeof import('react')
    if (root) await act(async () => root.unmount())
    jest.useRealTimers()
  })

  it('announces retry progress, disables repeat activation, then alerts and focuses failure', async () => {
    const { act } = require('react') as typeof import('react')
    const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus')
    await act(async () => {
      root.render(
        <HotelLuggageStoragePrototype
          evidence={createLuggageStorageFixture('error')}
          hotelId="retry-test"
          surface="handoff"
        />,
      )
    })

    const retry = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent === 'Try storage check again') as HTMLButtonElement | undefined
    expect(retry).toBeDefined()

    await act(async () => retry?.click())
    const checking = Array.from(document.querySelectorAll('button'))
      .find(button => button.textContent === 'Checking storage…') as HTMLButtonElement | undefined
    expect(checking?.disabled).toBe(true)
    expect(checking?.getAttribute('aria-disabled')).toBe('true')
    expect(document.querySelector('section')?.getAttribute('aria-busy')).toBe('true')
    expect(document.querySelector('[role="status"]')?.textContent).toContain('Checking luggage-storage details')

    await act(async () => {
      jest.advanceTimersByTime(500)
    })
    await act(async () => {
      jest.runOnlyPendingTimers()
    })

    const failure = document.querySelector('[role="alert"]') as HTMLElement | null
    expect(failure?.textContent).toBe('Storage details still could not be checked.')
    expect(failure?.getAttribute('tabindex')).toBe('-1')
    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(focusSpy.mock.instances[0]).toBe(failure)
  })
})
