import type { ReactElement } from 'react';
import type { BookingFareContext, BookingHotelContext } from '@/lib/booking/config';

type TestElement = ReactElement<Record<string, unknown>>;

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');

  return {
    ...actual,
    useEffect: jest.fn((effect: () => void) => effect()),
    useRef: jest.fn(() => ({ current: { focus: jest.fn() } })),
    useState: jest.fn((initialValue: unknown) => [initialValue, jest.fn()]),
  };
});

const { default: BookingFlow } = jest.requireActual('../BookingFlow') as typeof import('../BookingFlow');

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children;
  return Array.isArray(children) ? children : [children].filter(Boolean);
}

function resolveFunctionElement(node: TestElement): TestElement {
  let current = node;

  while (typeof current.type === 'function') {
    current = (current.type as (props: Record<string, unknown>) => TestElement)(current.props);
  }

  return current;
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join('');
  if (typeof node === 'object') {
    return childrenOf(resolveFunctionElement(node as TestElement)).map(collectText).join('');
  }
  return '';
}

const fareContext: BookingFareContext = {
  offerId: 'off_123',
  provider: 'duffel',
  origin: 'JFK',
  destination: 'LAX',
  depart: '2026-09-22T08:00:00.000Z',
  return: '2026-09-29T17:30:00.000Z',
  carrier: 'American Airlines',
  stops: 1,
  priceCents: 45001,
  currency: 'USD',
  passengerCount: 3,
  priceScope: 'party_total',
};

const oneAdultFareContext: BookingFareContext = {
  ...fareContext,
  passengerCount: 1,
  priceScope: 'per_person',
};

const hotelContext: BookingHotelContext = {
  kind: 'hotel',
  offerId: 'hotel_123',
  provider: 'hotellook',
  name: 'The Example Hotel',
  area: 'Midtown',
  priceCents: 18900,
  currency: 'USD',
  priceBasis: 'per_night_before_taxes_fees',
  providerUrl: 'https://tp.media/r?marker=hotel-marker',
};

describe('BookingFlow fare context review', () => {
  it('blocks review when selected fare context is missing', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: true,
      duffelSandbox: true,
      fareContext: null,
    }));

    expect(text).toContain("We can't identify this fare");
    expect(text).toContain('Selection details are missing');
    expect(text).toContain('Return to search and choose a current result before reviewing booking options.');
    expect(text).toContain('Back to search');
    expect(text).not.toContain('Confirm booking');
    expect(text).not.toContain('Current fare');
    expect(text).not.toContain('Traveler details');
    expect(text).not.toContain('No fare details were supplied');
  });

  it('shows the selected fare route, provider, passengers, and integer-cent price context', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext,
    }));

    expect(text).toContain('JFK to LAX');
    expect(text).toContain('JFK → LAX');
    expect(text).toContain('American Airlines');
    expect(text).toContain('Duffel sandbox');
    expect(text).toContain('$450.01');
    expect(text).toContain('3 adults');
    expect(text).toContain('total for 3 adults');
  });

  it('explains the one-adult traveler burden before collecting provider-required details', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: true,
      duffelSandbox: false,
      fareContext: oneAdultFareContext,
    }));

    expect(text).toContain('Verify this fare for 1 adult traveler');
    expect(text).toContain('Before you enter details');
    expect(text).toContain('Required by Duffel for this booking request');
    expect(text).toContain('Sent only when you choose verify');
    expect(text).toContain('No payment details are collected on this page');
    expect(text).toContain('Provider verification pending');
    expect(text).toContain('1 adult traveler');
    expect(text).toContain('Traveler identity');
    expect(text).toContain('Provider contact');
    expect(text).toContain('Verify fare with Duffel');
    expect(text).not.toContain('Confirm booking');
  });

  it('shows selected hotel identity, provider, currency, price basis, and provider confirmation copy', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext,
    }));

    expect(text).toContain('Review selected hotel');
    expect(text).toContain('The Example Hotel');
    expect(text).toContain('Area only');
    expect(text).toContain('Midtown');
    expect(text).toContain('Provider supplied an area, not a property address or map pin.');
    expect(text).toContain('Location evidence');
    expect(text).toContain('hotellook');
    expect(text).toContain('$189.00');
    expect(text).toContain('USD');
    expect(text).toContain('per night before taxes and fees');
    expect(text).toContain('Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.');
    expect(text).toContain('Continue to provider');
    expect(text).not.toContain('Traveler details');
    expect(text).not.toContain('Confirm booking');
  });

  it('preserves an inspectable provider pin in hotel review without rendering a legacy distance', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext: {
        ...hotelContext,
        location: {
          precision: 'coordinates',
          lat: 40.7484,
          lng: -73.9857,
          providerLocationName: 'Midtown',
          distance: { value: 0.3, unit: 'mi', referencePoint: 'city center' },
        },
      },
    }));

    expect(text).toContain('Provider map pin');
    expect(text).toContain('View property pin');
    expect(text).not.toContain('city center');
    expect(text).not.toContain('0.3 mi');
    expect(text).toContain('Continue to provider');
  });

  it('shows a recoverable hotel-specific error for malformed hotel handoff links', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext: null,
      invalidHotelSelection: true,
    }));

    expect(text).toContain("We can't identify this hotel");
    expect(text).toContain('integer-cent price, currency, price basis, and provider handoff URL');
    expect(text).toContain('Back to search');
    expect(text).not.toContain("We can't identify this fare");
  });
});
