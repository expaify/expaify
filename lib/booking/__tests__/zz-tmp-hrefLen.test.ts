import { buildHotelBookingHref, buildBookingHotelContext } from '../../lib/booking/config';
import type { HotelOffer } from '../../lib/types';

const base: HotelOffer = {
  id: 'hl-1029384756',
  name: 'The Kensington Garden Residences & Spa',
  area: 'South Kensington',
  stars: 4,
  location: {
    precision: 'exact',
    label: 'Address',
    address: '41-45 Harrington Gardens, South Kensington, London SW7 4JU, United Kingdom',
    area: 'South Kensington',
    lat: 51.4923,
    lng: -0.1837,
    source: 'provider',
    providerLocationName: 'Kensington Garden Residences',
  } as never,
  pricePerNight: { priceCents: 24_500, currency: 'USD' },
  priceBasis: 'per_night_before_taxes_fees',
  deeplink: 'https://tp.media/r?marker=affiliate-12345&trs=99887&p=4115&u=https%3A%2F%2Fwww.booking.com%2Fhotel%2Fgb%2Fkensington-garden-residences.en-gb.html&campaign_id=101',
  source: 'hotellook',
  documentReadiness: {
    status: 'not_provided',
    scope: 'rate',
    documentTypes: [],
    issuerByDocument: {},
    billingDetailsStep: 'unknown',
    source: { label: 'Hotellook' },
  },
  fundsPolicy: {
    state: 'complete',
    sourceLabel: 'Hotellook policy',
    scope: 'selected_stay',
    obligations: [{
      type: 'authorization_hold',
      amount: { kind: 'exact', money: { priceCents: 25_000, currency: 'USD' } },
      basis: 'per_stay',
      applicationWording: 'At check-in the property places a hold on your card',
      paymentMethodWording: 'Credit card in the lead guest name',
      returnOrRelease: { action: 'release', providerWording: 'released within 7 days after checkout' },
      sourceLabel: 'Hotellook policy',
      scope: 'selected_stay',
    }],
  },
};

it('measures inline hotel booking href length', () => {
  const baseline = buildHotelBookingHref(base);
  const continuity = {
    checkIn: '2026-09-14',
    checkOut: '2026-09-18',
    nightCount: 4,
    entrySource: 'search' as const,
    returnUrl: '/deals?criteriaSchema=1&criteriaVersion=abcd1234efgh&criteriaSource=deals_page&city=London&date_from=2026-09-14&date_to=2026-09-18&min_stars=4&sort=price',
    priceCheckedAt: '2026-07-30T09:14:22.000Z',
    dealScore: {
      percentile: 12, pctVsMedian: -18.4, medianCents: 30_000, currency: 'USD',
      verdict: 'Great' as const, confidence: 'high' as const, sampleSize: 42,
      explanation: 'This nightly rate is 18% below the usual price for this city over the last 90 days.',
    },
    hotelClass: { kind: 'hotel_class' as const, value: 4, scaleMax: 5, sourceLabel: 'Hotellook', confidence: 'provider_only' as const },
    guestRating: { kind: 'guest_review' as const, value: 8.7, scaleMax: 10, reviewCount: 2841, sourceLabel: 'Hotellook', confidence: 'verified' as const },
  };
  const ctx = buildBookingHotelContext(base, continuity as never);
  // rebuild inline href via the exported path
  const withCont = JSON.stringify(ctx);
  console.log('BASELINE_HREF_LEN', baseline.length);
  console.log('CTX_JSON_LEN', withCont.length);
  const delta = new URLSearchParams({
    checkIn: continuity.checkIn, checkOut: continuity.checkOut, nightCount: '4',
    entrySource: continuity.entrySource, returnUrl: continuity.returnUrl,
    priceCheckedAt: continuity.priceCheckedAt,
    dealScore: JSON.stringify(continuity.dealScore),
    hotelClass: JSON.stringify(continuity.hotelClass),
    guestRating: JSON.stringify(continuity.guestRating),
  }).toString();
  console.log('CONTINUITY_PARAM_LEN', delta.length);
  console.log('TOTAL', baseline.length + delta.length + 1);
});
