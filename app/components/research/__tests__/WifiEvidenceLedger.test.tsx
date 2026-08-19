import { renderToStaticMarkup } from 'react-dom/server'
import { WifiEvidenceLedger } from '../WifiEvidenceLedger'
import {
  createWifiFixture,
  isWifiResearchPrototypeEnabled,
  parseWifiFixture,
  type HotelWifiEvidence,
  type WifiFixtureId,
} from '../hotelWifiFixtures'

function fixture(id: Exclude<WifiFixtureId, 'control'>): HotelWifiEvidence {
  const evidence = createWifiFixture(id)
  if (!evidence) throw new Error(`Missing fixture ${id}`)
  return evidence
}

function render(id: Exclude<WifiFixtureId, 'control'>, suffix = 'test'): string {
  return renderToStaticMarkup(<WifiEvidenceLedger evidence={fixture(id)} idSuffix={suffix} />)
}

describe('Wi-Fi evidence research prototype', () => {
  it('is absent by default and cannot be activated in production by a query value', () => {
    expect(parseWifiFixture(undefined)).toBe('control')
    expect(parseWifiFixture('unknown')).toBe('control')
    expect(createWifiFixture('control')).toBeNull()
    expect(isWifiResearchPrototypeEnabled({ NODE_ENV: 'production', HOTEL_WIFI_RESEARCH: 'true' })).toBe(false)
    expect(isWifiResearchPrototypeEnabled({ NODE_ENV: 'test', HOTEL_WIFI_RESEARCH: 'true' })).toBe(true)
    expect(isWifiResearchPrototypeEnabled({ NODE_ENV: 'test' })).toBe(false)
  })

  it('WF-01 keeps access, rate cost, room coverage, and reliability independent', () => {
    const html = render('wf-01')
    expect(html).toContain('Wi-Fi is listed for the property.')
    expect(html).toContain('Not specified for this rate.')
    expect(html).toContain('Property-level only; guest-room coverage is not confirmed.')
    expect(html).toContain('Wi-Fi is listed, but reliability evidence is not available.')
    expect(html).toContain('Confirm Wi-Fi access, charges, and room coverage with the hotel or booking provider before you book.')
    expect(html).not.toMatch(/reliable Wi-Fi|Wi-Fi score|work-ready|video-call ready/i)
  })

  it('WF-02 does not turn rate inclusion or guest-room coverage into performance evidence', () => {
    const html = render('wf-02')
    expect(html).toContain('Included in the selected rate.')
    expect(html).toContain('Guest-room Wi-Fi is listed; this does not confirm every room.')
    expect(html).toContain('Reliability evidence</dt><dd><p')
    expect(html).toContain('Not established.')
    expect(html).not.toContain('Measured performance</h3>')
    expect(html).not.toContain('Guest-reported Wi-Fi</h3>')
  })

  it('WF-03 shows a complete, time-and-location-bound measured family', () => {
    const html = render('wf-03')
    expect(html).toContain('Measured performance is available below.')
    expect(html).toContain('Download: 84 Mbps')
    expect(html).toContain('Upload: 21 Mbps')
    expect(html).toContain('Latency: 32 ms')
    expect(html).toContain('Method: automated in-room network test.')
    expect(html).toContain('Based on 18 measurements.')
    expect(html).toContain('Source: Research Measurement Source · Reported Jun 30, 2026.')
    expect(html).toContain('This measurement is time- and location-bound and does not guarantee future performance.')
  })

  it('WF-04 keeps Wi-Fi-specific guest reporting separate from measurement', () => {
    const html = render('wf-04')
    expect(html).toContain('Wi-Fi-specific guest reports are available below.')
    expect(html).toContain('Guests report mixed experiences with in-room connection consistency.')
    expect(html).toContain('Based on 27 Wi-Fi-specific reviews from Jan 1, 2026–Jun 30, 2026.')
    expect(html).toContain('Reports were mixed.')
    expect(html).toContain('Guest reports describe past experiences; they are not a performance measurement or guarantee.')
    expect(html).not.toContain('Measured performance</h3>')
  })

  it('WF-05 retains both conflicting evidence families and their attributed statements', () => {
    const html = render('wf-05')
    expect(html).toContain('Wi-Fi evidence conflicts — confirm with the hotel.')
    expect(html).toContain('Measured performance and guest reports conflict.')
    expect(html).toContain('Research Measurement Source: Measurements recorded the displayed performance during the observation window.')
    expect(html).toContain('Research Review Source: Wi-Fi-specific guest reports describe mixed connection consistency.')
    expect(html.indexOf('Measured performance</h3>')).toBeLessThan(html.indexOf('Guest-reported Wi-Fi</h3>'))
  })

  it('WF-06 and WF-07A distinguish omitted evidence from a request error', () => {
    const omitted = render('wf-06')
    const error = render('wf-07a')
    expect(omitted).toContain('Wi-Fi details were not returned by this hotel source.')
    expect(error).toContain('Wi-Fi details could not be checked.')
    expect(omitted).toContain('Not specified')
    expect(error).toContain('Not specified')
    expect(`${omitted}${error}`).not.toMatch(/Wi-Fi is (?:reported )?unavailable/)
    expect(`${omitted}${error}`).not.toContain('<button')
  })

  it('WF-07B suppresses stale positive claims and metrics', () => {
    const html = render('wf-07b')
    expect(html).toContain('Wi-Fi information is out of date.')
    expect(html).toContain('Last reported Dec 15, 2025')
    expect(html).toContain('Not specified for this rate.')
    expect(html).not.toContain('Wi-Fi is listed for the property.')
    expect(html).not.toContain('Download: 84 Mbps')
  })

  it('WF-08 reserves unavailable for explicit selected-stay evidence', () => {
    const html = render('wf-08')
    expect(html).toContain('This source reports Wi-Fi is unavailable for the selected stay.')
    expect(html).toContain('Wi-Fi is reported unavailable for the selected stay.')
    expect(html).toContain('Not applicable because Wi-Fi is reported unavailable for the selected stay.')
    expect(html).toContain('Selected stay.')
  })

  it('WF-09 retains every attributed access and cost conflict statement', () => {
    const html = render('wf-09')
    expect(html).toContain('Sources disagree about Wi-Fi access.')
    expect(html).toContain('Sources disagree about the Wi-Fi charge for this rate.')
    expect(html).toContain('Research Hotel Source: Wi-Fi is listed for the property.')
    expect(html).toContain('Research Rate Source: Wi-Fi is not listed for the selected stay.')
    expect(html).toContain('Research Hotel Source: Property information describes Wi-Fi as free.')
    expect(html).toContain('Research Rate Source: The selected rate does not specify Wi-Fi inclusion.')
  })

  it('WF-10 suppresses the rejected malformed measurement without a partial claim', () => {
    const html = render('wf-10')
    expect(html).toContain('Not established.')
    expect(html).not.toContain('Measured performance</h3>')
    expect(html).not.toMatch(/Invalid Date|undefined|NaN/)
    expect(html).not.toContain('malformed-research-source')
  })

  it('implements the full loading structure with one polite live region', () => {
    const html = render('loading')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Checking Wi-Fi evidence…')
    expect(html.match(/Checking…/g)).toHaveLength(4)
  })

  it('WF-11 preserves the exact normalized fixture across serialization', () => {
    const detailEvidence = fixture('wf-05')
    const handoffEvidence = JSON.parse(JSON.stringify(detailEvidence)) as HotelWifiEvidence
    const detail = renderToStaticMarkup(<WifiEvidenceLedger evidence={detailEvidence} idSuffix="deal-detail" />)
    const handoff = renderToStaticMarkup(<WifiEvidenceLedger evidence={handoffEvidence} idSuffix="hotel-review" />)
    expect(handoff.replaceAll('hotel-review', 'deal-detail')).toBe(detail)
  })

  it('WF-12 keeps semantic order, a mobile-first grid, and no unexpected focus targets', () => {
    const html = render('wf-03')
    expect(html).toContain('<section aria-labelledby="wifi-evidence-title-test"')
    expect(html).toContain('<dl class="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">')
    expect(html.indexOf('Access</dt>')).toBeLessThan(html.indexOf('Cost for this rate</dt>'))
    expect(html.indexOf('Cost for this rate</dt>')).toBeLessThan(html.indexOf('Coverage</dt>'))
    expect(html.indexOf('Coverage</dt>')).toBeLessThan(html.indexOf('Reliability evidence</dt>'))
    expect(html.indexOf('Reliability evidence</dt>')).toBeLessThan(html.indexOf('Measured performance</h3>'))
    expect(html).not.toMatch(/<button|<a |overflow-x|truncate|line-clamp|h-\[/)
  })

  it('mounts only between Hotel fit and provider handoff on both active surfaces', () => {
    const fs = jest.requireActual('node:fs') as typeof import('node:fs')
    const detail = fs.readFileSync('app/deals/[dealId]/page.tsx', 'utf8')
    const handoff = fs.readFileSync('app/book/BookingFlow.tsx', 'utf8')
    const card = fs.readFileSync('app/components/ui/DealCard.tsx', 'utf8')
    const hotelCard = fs.readFileSync('app/components/HotelCard.tsx', 'utf8')

    // The legacy flag-off branch remains later in this file than the opt-in IA.
    expect(detail.lastIndexOf('id="saved-hotel-fit-title"')).toBeLessThan(detail.lastIndexOf('<WifiEvidenceLedger'))
    expect(detail.lastIndexOf('<WifiEvidenceLedger')).toBeLessThan(detail.lastIndexOf('id="saved-provider-title"'))
    expect(handoff.indexOf('<WifiEvidenceLedger')).toBeLessThan(handoff.indexOf('id="hotel-provider-title"'))
    expect(card).not.toContain('WifiEvidenceLedger')
    expect(hotelCard).not.toContain('WifiEvidenceLedger')
  })
})
