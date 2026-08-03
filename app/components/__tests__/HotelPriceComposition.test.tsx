import { renderToStaticMarkup } from 'react-dom/server'
import { buildHotelPriceComposition } from '@/lib/hotels/priceDisclosure'
import { HotelPriceComposition, HotelPriceCompositionScan } from '../HotelPriceComposition'

const capabilities = {
  taxes: { supportedScopes: ['stay'] as ('stay')[], supportsExplicitNone: true },
  mandatoryPropertyCharges: { supportedScopes: ['stay'] as ('stay')[], supportsExplicitNone: true },
}

describe('HotelPriceComposition provider evidence', () => {
  it('renders itemized amounts with independent inclusion and collection timing', () => {
    const composition = buildHotelPriceComposition({
      offerId: 'hotel-1', supplier: 'provider-1', stayCostState: 'provider_total', capabilities,
      taxEvidence: {
        offerId: 'hotel-1', supplier: 'provider-1', sourceLabel: 'Future Provider', scope: 'stay',
        state: 'itemized', totalRelationship: 'included', collection: 'online',
        categoryTotal: { priceCents: 4200, currency: 'USD' }, records: [],
      },
      mandatoryPropertyChargeEvidence: {
        offerId: 'hotel-1', supplier: 'provider-1', sourceLabel: 'Future Provider', scope: 'stay',
        state: 'itemized', totalRelationship: 'included', collection: 'property',
        categoryTotal: { priceCents: 3000, currency: 'USD' }, records: [],
      },
    })
    const markup = renderToStaticMarkup(<HotelPriceComposition
      headingId="composition"
      stayCostState="provider_total"
      composition={composition}
      variant="handoff"
    />)

    expect(markup).toContain('$42 USD')
    expect(markup).toContain('$30 USD')
    expect(markup).toContain('Included in provider total.')
    expect(markup).toContain('Collected online.')
    expect(markup).toContain('Pay at property.')
  })

  it('keeps conflict copy visible and does not choose a winning record', () => {
    const composition = buildHotelPriceComposition({
      offerId: 'hotel-1', supplier: 'provider-1', stayCostState: 'provider_total', capabilities,
      taxEvidence: {
        offerId: 'hotel-1', supplier: 'provider-1', sourceLabel: 'Future Provider', scope: 'stay',
        state: 'itemized', totalRelationship: 'unknown', collection: 'online', records: [
          { name: 'Tax A', required: true, amount: { priceCents: 1000, currency: 'USD' }, totalRelationship: 'included' },
          { name: 'Tax B', required: true, amount: { priceCents: 500, currency: 'USD' }, totalRelationship: 'excluded' },
        ],
      },
    })
    const scan = renderToStaticMarkup(<HotelPriceCompositionScan composition={composition} />)
    const detail = renderToStaticMarkup(<HotelPriceComposition
      headingId="composition"
      stayCostState="provider_total"
      composition={composition}
      variant="price_scope"
    />)

    expect(scan).toContain('Taxes: details conflict')
    expect(detail).toContain('Provider details conflict. Confirm the amount and terms before booking.')
    expect(detail).toContain('Show 2 tax items')
    expect(detail).toContain('Tax A')
    expect(detail).toContain('Tax B')
  })
})
