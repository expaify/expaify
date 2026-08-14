import type { NormalizedFare } from '@/lib/types'

/**
 * A fare's price in cents on a party-total basis, safe to compare or sum
 * across fares from different providers.
 *
 * priceScope varies by provider (travelpayouts tags fares 'per_person';
 * duffel/amadeus/kiwi/googleFlights tag 'party_total') -- comparing raw
 * price.priceCents directly mixes the two bases (duffel/kiwi/googleFlights
 * tag 'party_total'). This has been invisible so far because the current
 * search UI always requests 1 passenger, where the
 * two bases are numerically identical; it stops being invisible the moment
 * party size > 1 is wired up. Fares with no priceScope (or no passengerCount
 * to scale by) are treated as already party-total, matching the majority of
 * providers rather than risking an unwarranted multiplication.
 */
export function comparablePriceCents(fare: NormalizedFare): number {
  if (fare.priceScope === 'per_person' && typeof fare.passengerCount === 'number' && fare.passengerCount > 0) {
    return fare.price.priceCents * fare.passengerCount
  }
  return fare.price.priceCents
}
