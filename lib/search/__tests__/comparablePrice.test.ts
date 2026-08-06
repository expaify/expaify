import type { NormalizedFare } from '@/lib/types'
import { comparablePriceCents } from '../comparablePrice'

function makeFare(overrides: Partial<NormalizedFare> = {}): NormalizedFare {
  return {
    id: 'fare-1',
    fareType: 'cash',
    origin: 'JFK',
    destination: 'LAX',
    depart: '2026-09-01T09:00:00.000Z',
    stops: 0,
    carrier: 'AA',
    price: { priceCents: 10000, currency: 'USD' },
    deeplink: 'https://example.com',
    source: 'travelpayouts',
    fetchedAt: '2026-06-30T00:00:00.000Z',
    ...overrides,
  }
}

describe('comparablePriceCents', () => {
  it('multiplies a per_person fare by its passenger count', () => {
    const fare = makeFare({ priceScope: 'per_person', passengerCount: 3, price: { priceCents: 10000, currency: 'USD' } })
    expect(comparablePriceCents(fare)).toBe(30000)
  })

  it('leaves a party_total fare unchanged', () => {
    const fare = makeFare({ priceScope: 'party_total', passengerCount: 3, price: { priceCents: 25000, currency: 'USD' } })
    expect(comparablePriceCents(fare)).toBe(25000)
  })

  it('leaves a fare with no priceScope unchanged (defaults to already-comparable)', () => {
    const fare = makeFare({ priceScope: undefined, price: { priceCents: 25000, currency: 'USD' } })
    expect(comparablePriceCents(fare)).toBe(25000)
  })

  it('leaves a per_person fare unchanged when passengerCount is missing rather than guessing', () => {
    const fare = makeFare({ priceScope: 'per_person', passengerCount: undefined, price: { priceCents: 10000, currency: 'USD' } })
    expect(comparablePriceCents(fare)).toBe(10000)
  })

  it('leaves a per_person fare unchanged when passengerCount is zero', () => {
    const fare = makeFare({ priceScope: 'per_person', passengerCount: 0, price: { priceCents: 10000, currency: 'USD' } })
    expect(comparablePriceCents(fare)).toBe(10000)
  })
})
