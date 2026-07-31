import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { parseHTML } from 'linkedom'
import HotelCheckinTimeFitResearchPage, { metadata } from '@/app/research/hotel-checkin-time-fit/page'
import {
  HotelCheckinTimeFitPrototype,
  HotelCheckinTimeFitResearchHarness,
} from '../HotelCheckinTimeFitPrototype'
import {
  createHotelTimeFitFixture,
  HOTEL_TIME_FIT_FIXTURE_IDS,
  resolveHotelTimeFit,
  type TimeFitFixtureId,
} from '../hotelCheckinTimeFitFixtures'

function renderFixture(id: TimeFitFixtureId, surface: 'detail' | 'handoff' = 'detail') {
  return renderToStaticMarkup(
    <HotelCheckinTimeFitPrototype fixture={createHotelTimeFitFixture(id)} surface={surface} allowRetry />,
  )
}

describe('HotelCheckinTimeFitPrototype rendering', () => {
  it.each(HOTEL_TIME_FIT_FIXTURE_IDS)('renders the complete %s decision unit', id => {
    const fixture = createHotelTimeFitFixture(id)
    const presentation = resolveHotelTimeFit(fixture)
    const html = renderFixture(id)

    expect(html).toContain('Arrival and departure time fit')
    expect(html).toContain(presentation.outcomeCopy)
    expect(html).toContain(presentation.comparisonCopy)
    if (id === 'evidence_loading') expect(html).toContain('animate-pulse')
    else expect(html).toContain('Published standard times')
    expect(html).toMatch(/(?:Next step|next step)/)
    expect(html).toContain('expaify has not selected, sent, acknowledged, or guaranteed a time exception.')
    expect(html).toContain('Research prototype — hotel time fit is not part of ranking or Deal Score.')
    expect(html).toContain(`Fixture revision: ${fixture.evidence.evidenceRevision}`)
    expect(html).toContain(`data-fixture-revision="${fixture.evidence.evidenceRevision}"`)
  })

  it('renders published facts and obligation without relabeling the cutoff', () => {
    const early = renderFixture('early_arrival_request')
    expect(early).toContain('Standard room access starts: 3:00 PM')
    expect(early).toContain('Early check-in is request-only and not guaranteed.')

    const obligation = renderFixture('late_obligation_only')
    expect(obligation).toContain('Late-arrival instruction: Contact the property before arrival if you arrive after 10:00 PM.')
    expect(obligation).toContain('This does not show whether your arrival fits the standard check-in period.')
    expect(obligation).not.toMatch(/standard check-in ends at 10:00 PM|desk closes|late check-in available/i)
  })

  it('renders conflicts source by source without selecting a current claim', () => {
    const html = renderFixture('conflicting_boundary')
    expect(html).toContain('Synthetic property page:')
    expect(html).toContain('Synthetic provider listing:')
    expect(html).toContain('No source was chosen as current.')
  })

  it('uses one polite atomic status for loading, hides three skeletons, and keeps the section busy', () => {
    const html = renderFixture('evidence_loading')
    expect(html).toContain('aria-busy="true"')
    expect((html.match(/role="status"/g) ?? [])).toHaveLength(1)
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('aria-atomic="true"')
    expect(html).toContain('aria-hidden="true"')
    expect((html.match(/animate-pulse/g) ?? [])).toHaveLength(3)
  })

  it('uses neutral fit treatment and a non-alarm reading accent for mismatch and uncertainty', () => {
    expect(renderFixture('early_departure_control')).not.toContain('border-l-[color:var(--gold-deep)]')
    expect(renderFixture('early_arrival_request')).toContain('border-l-[color:var(--gold-deep)]')
    expect(renderFixture('missing_departure_boundary')).toContain('border-l-[color:var(--gold-deep)]')
    expect(renderFixture('early_arrival_request')).not.toContain('text-[color:var(--error)]')
  })

  it('keeps mobile content wrap-safe and enables a two-column fact/action layout only at desktop width', () => {
    const html = renderFixture('post_checkout_request', 'handoff')
    expect(html).toContain('min-w-0')
    expect(html).toContain('break-words')
    expect(html).toContain('md:grid-cols-2')
    expect(renderFixture('evidence_error')).toContain('btn btn-outline mt-4 w-full sm:w-auto')
    expect(html).not.toMatch(/truncate|line-clamp|overflow-x-auto|h-\[/)
  })

  it('repeats request guidance at handoff without duplicating request definitions', () => {
    const detail = renderFixture('early_arrival_request', 'detail')
    const handoff = renderFixture('early_arrival_request', 'handoff')
    expect(detail).not.toContain('See Special requests below for how requests work.')
    expect(handoff).toContain('See Special requests below for how requests work.')
    expect(handoff).not.toContain('How requests work')
  })

  it('supports the facts-first research condition while keeping outcome and comparison visible', () => {
    const fixture = createHotelTimeFitFixture('early_arrival_request')
    const html = renderToStaticMarkup(<HotelCheckinTimeFitPrototype fixture={fixture} surface="detail" hierarchy="facts_first" />)
    expect(html.indexOf('Published standard times')).toBeLessThan(html.indexOf('Outside standard times'))
    expect(html).toContain('You plan to arrive at 12:00 PM; standard room access starts at 3:00 PM.')
  })
})

describe('/research/hotel-checkin-time-fit route and isolation', () => {
  it('renders an indexed-off research harness with product-shaped hierarchy and native controls', () => {
    const html = renderToStaticMarkup(<HotelCheckinTimeFitResearchPage />)
    const stayIndex = html.indexOf('Stay details')
    const priceIndex = html.indexOf('Price and Deal Score')
    const fitIndex = html.indexOf('Hotel fit')
    const continueIndex = html.indexOf('Continue in prototype')

    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(HotelCheckinTimeFitResearchPage()).toEqual(expect.objectContaining({ type: HotelCheckinTimeFitResearchHarness }))
    expect(html).toContain('Hotel arrival and departure time fit')
    expect(html).toContain('Blocked: published standard check-in end and local-day association are not represented by the upstream logistics contract.')
    expect(html).toContain('late_known_end_no_path')
    expect(html).toContain('disabled=""')
    expect(stayIndex).toBeGreaterThan(-1)
    expect(priceIndex).toBeGreaterThan(stayIndex)
    expect(fitIndex).toBeGreaterThan(priceIndex)
    expect(continueIndex).toBeGreaterThan(fitIndex)
    expect(html).toContain('md:grid-cols-3')
    expect(html).not.toMatch(/<a |href=|target=/)
  })

  it('announces an async state only once across the result, detail, and handoff condition', () => {
    const loadingHarness = renderToStaticMarkup(<HotelCheckinTimeFitResearchHarness />)
    expect(loadingHarness).not.toContain('aria-busy="true"')

    const fixture = createHotelTimeFitFixture('evidence_loading')
    const paired = renderToStaticMarkup(<>
      <HotelCheckinTimeFitPrototype fixture={fixture} surface="detail" />
      <HotelCheckinTimeFitPrototype fixture={fixture} surface="handoff" announceAsync={false} />
    </>)
    expect((paired.match(/role="status"/g) ?? [])).toHaveLength(1)
  })

  it('does not wire the prototype into production surfaces, contracts, providers, or analytics', () => {
    const root = process.cwd()
    const productionFiles = [
      'app/page.tsx',
      'app/components/HotelCard.tsx',
      'app/components/HotelDecisionAnalytics.tsx',
      'app/book/BookingFlow.tsx',
      'app/api/book/hotel-context/route.ts',
      'lib/types.ts',
      ...readdirSync(join(root, 'lib/providers'))
        .filter(file => file.endsWith('.ts'))
        .map(file => `lib/providers/${file}`),
    ]
    const productionSource = productionFiles.map(file => readFileSync(join(root, file), 'utf8')).join('\n')
    expect(productionSource).not.toMatch(/HotelCheckinTimeFit|hotelCheckinTimeFit|hotel time fit/i)
  })
})

describe('HotelCheckinTimeFitPrototype keyboard and focus behavior', () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
    const domWindow = window as unknown as typeof globalThis
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: new URL('https://expaify.test/research/hotel-checkin-time-fit'),
    })
    Object.assign(globalThis, {
      window,
      document: window.document,
      navigator: window.navigator,
      HTMLElement: domWindow.HTMLElement,
      Node: domWindow.Node,
      Event: domWindow.Event,
      KeyboardEvent: domWindow.KeyboardEvent,
      MouseEvent: domWindow.MouseEvent,
      IS_REACT_ACT_ENVIRONMENT: true,
    })
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback) => { callback(0); return 1 },
    })
  })

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>'
    container = document.querySelector('#root') as HTMLDivElement
    root = createRoot(container)
  })

  afterEach(async () => {
    if (root) await act(async () => root.unmount())
    jest.restoreAllMocks()
  })

  it('uses a native Details button, retains focus, and does not move focus to the outcome', async () => {
    const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus')
    await act(async () => root.render(<HotelCheckinTimeFitResearchHarness />))
    const details = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Details') as HTMLButtonElement
    details.focus()
    expect(focusSpy).toHaveBeenCalledTimes(1)
    await act(async () => details.click())
    expect(details.getAttribute('aria-expanded')).toBe('false')
    expect(focusSpy).toHaveBeenCalledTimes(1)
    await act(async () => details.click())
    expect(details.getAttribute('aria-expanded')).toBe('true')
    expect(focusSpy).toHaveBeenCalledTimes(1)
    focusSpy.mockRestore()
  })

  it('deterministically retries without a provider call and retains focus on the retry control', async () => {
    const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus')
    const fixture = createHotelTimeFitFixture('evidence_error')
    await act(async () => root.render(<HotelCheckinTimeFitPrototype fixture={fixture} surface="detail" allowRetry />))
    const retry = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Retry scenario check') as HTMLButtonElement
    retry.focus()
    await act(async () => retry.click())
    expect(retry.textContent).toBe('Scenario check updated')
    expect(retry.disabled).toBe(true)
    expect(focusSpy).toHaveBeenCalledTimes(2)
    expect(focusSpy.mock.instances).toEqual([retry, retry])
    expect(document.querySelector('[role="status"]')?.textContent).toContain('standard room access starts at 3:00 PM')
    focusSpy.mockRestore()
  })
})
