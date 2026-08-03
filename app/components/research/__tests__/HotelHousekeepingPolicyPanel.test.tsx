import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import HotelHousekeepingFrequencyResearchPage, { metadata } from '@/app/research/hotel-housekeeping-frequency/page'
import { HotelHousekeepingPolicyPanel, type HousekeepingSurface } from '../HotelHousekeepingPolicyPanel'
import { HotelHousekeepingResearchHarness } from '../HotelHousekeepingResearchHarness'
import { createHousekeepingFixture, HOUSEKEEPING_FIXTURE_IDS } from '../hotelHousekeepingFixtures'

const PRIMARY = {
  F1: 'Room cleaning: daily.', F2: 'Room cleaning: only when requested.', F3: 'Room cleaning: every 2 nights.',
  F4: 'No stayover room cleaning is reported for this policy.', F5: 'Schedule unclear',
  F6: 'Housekeeping information conflicts', F7: 'Schedule not returned', F8: 'Could not check schedule',
  F9: 'Room cleaning: only when requested.',
} as const

function renderFixture(id: keyof typeof PRIMARY, surface: HousekeepingSurface = 'saved_detail') {
  return renderToStaticMarkup(<HotelHousekeepingPolicyPanel fixture={createHousekeepingFixture(id)} surface={surface} variant="summary_first" />)
}

describe('HotelHousekeepingPolicyPanel fixture surfaces', () => {
  it.each(HOUSEKEEPING_FIXTURE_IDS)('renders exact hierarchy and state copy for %s', id => {
    const html = renderFixture(id)
    expect(html).toContain('Room cleaning during your stay')
    expect(html).toContain(PRIMARY[id])
    expect(html.indexOf(PRIMARY[id])).toBeLessThan(html.indexOf('Towels'))
    expect(html.indexOf('Towels')).toBeLessThan(html.indexOf('Bed linen'))
    expect(html).toContain(`data-evidence-revision="${createHousekeepingFixture(id).evidenceRevision}"`)
  })

  it('preserves formatted semantics and revisions across both continuity paths', () => {
    for (const id of HOUSEKEEPING_FIXTURE_IDS) {
      for (const [detail, handoff] of [['saved_detail', 'saved_handoff'], ['offer_detail', 'review_handoff']] as const) {
        const detailHtml = renderFixture(id, detail)
        const handoffHtml = renderFixture(id, handoff)
        for (const value of [PRIMARY[id], createHousekeepingFixture(id).towels, createHousekeepingFixture(id).bedLinen]) {
          expect(detailHtml).toContain(value)
          expect(handoffHtml).toContain(value)
        }
        expect(detailHtml).toContain(createHousekeepingFixture(id).evidenceRevision)
        expect(handoffHtml).toContain(createHousekeepingFixture(id).evidenceRevision)
      }
    }
  })

  it('uses distinct truthful empty and error copy without disclosures', () => {
    const empty = renderFixture('F7')
    expect(empty).toContain('This provider did not return a housekeeping schedule.')
    expect(empty).not.toContain('No stayover room cleaning')
    expect(empty).not.toContain('Show provider wording')
    expect(empty).not.toContain('Try again')

    const error = renderFixture('F8')
    expect(error).toContain('We could not check the room-cleaning, towel, or bed-linen schedules.')
    expect(error).not.toContain('did not return')
    expect(error).toContain('Try again')
    expect(error).toContain('w-full sm:w-auto')
  })

  it('keeps responsive rows wrap-safe and state meaning textual', () => {
    const html = renderFixture('F6', 'saved_handoff')
    expect(html).toContain('grid-cols-1')
    expect(html).toContain('sm:grid-cols-2')
    expect(html).toContain('min-w-0')
    expect(html).toContain('[overflow-wrap:anywhere]')
    expect(html).toContain('Current provider statements do not establish one cleaning schedule. Verify before booking.')
  })
})

describe('/research/hotel-housekeeping-frequency route and isolation', () => {
  it('renders the unlinked harness controls and fictional-data warning', () => {
    const html = renderToStaticMarkup(<HotelHousekeepingFrequencyResearchPage />)
    expect(html).toContain('Research prototype — policies shown here are fictional')
    expect(html).toContain('375px mobile')
    expect(html).toContain('1280px desktop')
    expect(html).toContain('A — summarized dimensions')
    expect(html).toContain('B — provider wording first')
    expect(html).toContain('Saved-deal detail')
    expect(html).toContain('Saved-deal handoff')
    expect(html).toContain('HotelCard details')
    expect(html).toContain('Hotel review handoff')
    expect(html).toContain('Reset scenario')
  })

  it('keeps the route out of search indexing', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false })
    expect(HotelHousekeepingFrequencyResearchPage()).toEqual(expect.objectContaining({ type: HotelHousekeepingResearchHarness }))
  })

  it('keeps research fixtures out of production hotel paths', () => {
    const root = process.cwd()
    const productionFiles = [
      'app/components/HotelCard.tsx', 'app/book/BookingFlow.tsx', 'app/deals/[dealId]/page.tsx',
      'app/api/book/hotel-context/route.ts', 'app/api/analytics/route.ts', 'lib/types.ts',
      ...readdirSync(join(root, 'lib/providers')).filter(file => file.endsWith('.ts')).map(file => `lib/providers/${file}`),
    ]
    const source = productionFiles.map(file => readFileSync(join(root, file), 'utf8')).join('\n')
    expect(source).not.toMatch(/hotelHousekeepingFixtures|HotelHousekeepingPolicyPanel|housekeeping-frequency/i)
  })
})

describe('HotelHousekeepingPolicyPanel interactions', () => {
  let container: HTMLDivElement
  let root: import('react-dom/client').Root

  beforeAll(() => {
    const { parseHTML } = require('linkedom') as { parseHTML: (html: string) => { window: Window } }
    const { window } = parseHTML('<!doctype html><html><body><div id="root"></div></body></html>')
    const domWindow = window as unknown as typeof globalThis
    Object.defineProperty(window, 'location', { configurable: true, value: new URL('https://expaify.test/research/hotel-housekeeping-frequency') })
    Object.assign(globalThis, { window, document: window.document, navigator: window.navigator, HTMLElement: domWindow.HTMLElement, Node: domWindow.Node, Event: domWindow.Event, KeyboardEvent: domWindow.KeyboardEvent, MouseEvent: domWindow.MouseEvent, IS_REACT_ACT_ENVIRONMENT: true })
  })

  beforeEach(() => {
    jest.useFakeTimers(); document.body.innerHTML = '<div id="root"></div>'; container = document.querySelector('#root') as HTMLDivElement
    const { createRoot } = require('react-dom/client') as typeof import('react-dom/client'); root = createRoot(container)
  })

  afterEach(async () => { const { act } = require('react') as typeof import('react'); if (root) await act(async () => root.unmount()); jest.useRealTimers() })

  it('opens provider wording and Escape closes it with focus restored', async () => {
    const { act } = require('react') as typeof import('react')
    const focusSpy = jest.spyOn(HTMLElement.prototype, 'focus')
    await act(async () => root.render(<HotelHousekeepingPolicyPanel fixture={createHousekeepingFixture('F9')} surface="saved_detail" variant="summary_first" />))
    const trigger = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Show provider wording') as HTMLButtonElement
    await act(async () => trigger.click())
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(container.textContent).toContain('Broader property information')
    expect(container.textContent).toContain('The room policy is more specific to this selection.')
    const region = document.querySelector(`#${trigger.getAttribute('aria-controls')}`) as HTMLElement
    const escape = new Event('keydown', { bubbles: true })
    Object.defineProperty(escape, 'key', { value: 'Escape' })
    await act(async () => region.dispatchEvent(escape))
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(focusSpy).toHaveBeenCalledWith()
    focusSpy.mockRestore()
  })

  it('announces and locks retry, then resolves deterministically', async () => {
    const { act } = require('react') as typeof import('react')
    await act(async () => root.render(<HotelHousekeepingPolicyPanel fixture={createHousekeepingFixture('F8')} surface="review_handoff" variant="summary_first" retryOutcome="success" />))
    const retry = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Try again') as HTMLButtonElement
    await act(async () => retry.click())
    expect(retry.disabled).toBe(true)
    expect(retry.textContent).toBe('Checking again…')
    expect(document.querySelector('section')?.getAttribute('aria-busy')).toBe('true')
    await act(async () => { jest.advanceTimersByTime(500) })
    expect(container.textContent).toContain('Room cleaning: daily.')
    expect(container.textContent).not.toContain('Try again')
  })

  it('keeps failed retry in place and announces the exact failure copy', async () => {
    const { act } = require('react') as typeof import('react')
    await act(async () => root.render(<HotelHousekeepingPolicyPanel fixture={createHousekeepingFixture('F8')} surface="saved_handoff" variant="summary_first" retryOutcome="failure" />))
    const retry = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Try again') as HTMLButtonElement
    await act(async () => retry.click())
    await act(async () => { jest.advanceTimersByTime(500) })
    expect(container.textContent).toContain('We still could not check the housekeeping schedule.')
    expect(container.textContent).toContain('Could not check schedule')
  })
})
