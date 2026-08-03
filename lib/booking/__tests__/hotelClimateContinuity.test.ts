import type { HotelOffer } from '../../types'
import {
  buildBookingHotelContext,
  buildHotelBookingHref,
  hotelBookingHrefRequiresReference,
  parseBookingHotelContext,
  validateStructuredBookingHotelContext,
} from '../config'
import { createHotelClimateFixture } from '@/app/components/research/hotelClimateFixtures'

const hotel: HotelOffer = {
  id: 'synthetic-offer',
  name: 'Synthetic Climate Hotel',
  area: 'Test district',
  stars: 4,
  pricePerNight: { priceCents: 18_900, currency: 'USD' },
  deeplink: 'https://tp.media/r?marker=affiliate',
  source: 'synthetic-provider',
  documentReadiness: {
    status: 'not_provided', scope: 'rate', documentTypes: [], issuerByDocument: {},
    billingDetailsStep: 'unknown', source: { label: 'Synthetic provider' },
  },
  fundsPolicy: {
    state: 'not_returned', obligations: [], sourceLabel: 'Synthetic provider', scope: 'not_returned',
  },
  climateEvidence: createHotelClimateFixture('selected_room_rate'),
}

describe('hotel climate booking continuity', () => {
  it('preserves byte-equivalent evidence through inline and structured review contexts', () => {
    const context = buildBookingHotelContext(hotel)
    const structured = validateStructuredBookingHotelContext(JSON.parse(JSON.stringify(context)))
    const href = buildHotelBookingHref(hotel)
    expect(hotelBookingHrefRequiresReference(href)).toBe(false)
    const params = Object.fromEntries(new URL(href, 'https://expaify.test').searchParams.entries())
    const inline = parseBookingHotelContext(params)

    expect(JSON.stringify(structured?.climateEvidence)).toBe(JSON.stringify(context.climateEvidence))
    expect(JSON.stringify(inline?.climateEvidence)).toBe(JSON.stringify(context.climateEvidence))
  })

  it('fails malformed evidence closed without blocking the affiliate handoff context', () => {
    const context = buildBookingHotelContext(hotel) as unknown as Record<string, unknown>
    const evidence = structuredClone(context.climateEvidence) as ReturnType<typeof createHotelClimateFixture>
    const reversedRows = [...evidence.rows].reverse() as unknown as typeof evidence.rows
    context.climateEvidence = { ...evidence, rows: reversedRows }
    const validated = validateStructuredBookingHotelContext(context)

    expect(validated).not.toBeNull()
    expect(validated?.climateEvidence).toBeUndefined()
    expect(validated?.providerUrl).toBe(hotel.deeplink)
  })

  it('uses stored context rather than truncating an oversized immutable snapshot', () => {
    const conflict = createHotelClimateFixture('missing_failed_conflict')
    for (let index = 0; index < 18; index += 1) {
      conflict.rows[2].statements.push({
        ...conflict.rows[2].statements[index % 2],
        id: `conflict-${index}`,
        sourceWording: 'Bounded provider qualification that must survive stored context without truncating semantic evidence.'.padEnd(180, '.'),
      })
    }
    const href = buildHotelBookingHref({ ...hotel, climateEvidence: conflict })
    expect(hotelBookingHrefRequiresReference(href)).toBe(true)
  })
})

