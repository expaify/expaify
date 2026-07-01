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
    expect(text).toContain('missing required fare details');
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

  it('shows selected hotel identity, provider, currency, price basis, and provider confirmation copy', () => {
    const text = collectText(BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext,
    }));

    expect(text).toContain('Review selected hotel');
    expect(text).toContain('The Example Hotel');
    expect(text).toContain('Midtown');
    expect(text).toContain('hotellook');
    expect(text).toContain('$189.00');
    expect(text).toContain('USD');
    expect(text).toContain('per night before taxes and fees');
    expect(text).toContain('Taxes, fees, cancellation policy, room details, and live availability still require provider confirmation.');
    expect(text).toContain('Continue to provider');
    expect(text).not.toContain('Traveler details');
    expect(text).not.toContain('Confirm booking');
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
