import type { ReactElement } from 'react';
import type { BookingFareContext, BookingHotelContext } from '@/lib/booking/config';

type TestElement = ReactElement<Record<string, unknown>>;
const trackMock = jest.fn();

jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

jest.mock('react', () => {
  const actual = jest.requireActual('react') as typeof import('react');

  return {
    ...actual,
    useEffect: jest.fn((effect: () => void) => effect()),
    useMemo: jest.fn((factory: () => unknown) => factory()),
    useRef: jest.fn((initialValue: unknown) => ({ current: initialValue === null ? { focus: jest.fn() } : initialValue })),
    useState: jest.fn((initialValue: unknown) => [initialValue, jest.fn()]),
  };
});

const { default: BookingFlow } = jest.requireActual('../BookingFlow') as typeof import('../BookingFlow');

function childrenOf(node: TestElement): unknown[] {
  const children = node.props?.children;
  return Array.isArray(children) ? children : [children].filter(Boolean);
}

function resolveFunctionElement(node: TestElement): unknown {
  let current: unknown = node;

  while (current && typeof current === 'object' && typeof (current as TestElement).type === 'function') {
    const element = current as TestElement;
    current = (element.type as (props: Record<string, unknown>) => unknown)(element.props);
  }

  return current;
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(collectText).join('');
  if (typeof node === 'object') {
    const resolved = resolveFunctionElement(node as TestElement);
    if (!resolved || typeof resolved !== 'object') return collectText(resolved);
    return childrenOf(resolved as TestElement).map(collectText).join('');
  }
  return '';
}

function findElements(node: unknown, predicate: (element: TestElement) => boolean): TestElement[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(child => findElements(child, predicate));

  const resolved = resolveFunctionElement(node as TestElement);
  if (!resolved || typeof resolved !== 'object') return [];
  const element = resolved as TestElement;
  return [
    ...(predicate(element) ? [element] : []),
    ...childrenOf(element).flatMap(child => findElements(child, predicate)),
  ];
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
  beforeEach(() => {
    trackMock.mockClear();
  });

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

  it('shows the unresolved-partner handoff with honest rate and responsibility context', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext,
    });
    const text = collectText(tree);

    expect(text).toContain('Hotel review');
    expect(text).toContain('The Example Hotel');
    expect(text).toContain('Area');
    expect(text).toContain('Midtown');
    expect(text).toContain('Provider supplied an area, not a street address.');
    expect(text).toContain('Hotellook');
    expect(text).toContain('$189.00');
    expect(text).toContain('per night before taxes and fees');
    expect(text).toContain('Stay dates not provided');
    expect(text).toContain('Deal Score unavailable');
    expect(text).toContain('Hotel class not provided');
    expect(text).toContain('Guest rating not provided');
    expect(text).toContain('Check rooms at provider');
    expect(text).toContain('The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.');
    expect(text).toContain('Opens the provider site in a new tab. Your expaify page stays open.');
    expect(text).not.toContain('Provider confirmation required');
    expect(text).not.toContain('Before you continue');
    expect(text).not.toContain('Continue to');
    expect(text).not.toContain('tp.media takes payment');
    expect(text).not.toContain('Traveler details');
    expect(text).not.toContain('Confirm booking');

    const outbound = findElements(tree, element => element.type === 'a' && element.props.target === '_blank')[0];
    expect(outbound.props.href).toBe(hotelContext.providerUrl);
    expect(outbound.props.rel).toBe('noopener noreferrer sponsored');
    expect(outbound.props['aria-label']).toBe('Check rooms at provider for The Example Hotel. Opens in a new tab. The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.');
  });

  it('names a resolved destination without changing its affiliate URL', () => {
    const providerUrl = 'https://www.booking.com/hotel/x?aid=123&label=a%2Bb';
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext: { ...hotelContext, providerUrl },
    });
    const text = collectText(tree);
    const outbound = findElements(tree, element => element.type === 'a' && element.props.target === '_blank')[0];

    expect(text).toContain('Check rooms at Booking.com');
    expect(text).toContain('The provider confirms room details, live availability, final total, taxes and fees, cancellation policy, and terms.');
    expect(outbound.props.href).toBe(providerUrl);
    expect(outbound.props.target).toBe('_blank');
    expect(outbound.props.rel).toBe('noopener noreferrer sponsored');
  });

  it.each([
    ['search_area', 'Only the searched destination is available. Confirm the property location with the provider.'],
    ['missing', 'No property location details were returned.'],
  ] as const)('preserves the %s location warning without disabling handoff', (precision, warning) => {
    const contextualHotel: BookingHotelContext = {
      ...hotelContext,
      area: undefined,
      location: precision === 'search_area'
        ? { precision, label: 'New York' }
        : { precision },
    };
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext: contextualHotel,
    });

    expect(collectText(tree)).toContain(warning);
    expect(findElements(tree, element => element.type === 'a' && element.props.target === '_blank')).toHaveLength(1);
  });

  it('emits the viewed and guarded back analytics events with hostname-only props', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const anchors = findElements(tree, element => element.type === 'a');
    const backLink = anchors.find(element => element.props.href === '/' && typeof element.props.onClick === 'function');

    expect(trackMock).toHaveBeenCalledWith('hotel_handoff_viewed', {
      source: 'hotellook',
      partnerHost: 'tp.media',
      currency: 'USD',
      priceCents: 18900,
      priceBasis: 'per_night_before_taxes_fees',
      locationPrecision: 'area',
    });

    (backLink?.props.onClick as (() => void))();
    expect(trackMock).toHaveBeenCalledWith('hotel_handoff_back_clicked', {
      source: 'hotellook',
      partnerHost: 'tp.media',
    });
  });

  it('emits continue and one bucketed return after a hidden-visible cycle', () => {
    let visibilityState: 'visible' | 'hidden' = 'visible';
    let visibilityListener: (() => void) | undefined;
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        get visibilityState() { return visibilityState; },
        addEventListener: jest.fn((event: string, listener: () => void) => {
          if (event === 'visibilitychange') visibilityListener = listener;
        }),
        removeEventListener: jest.fn(),
      },
    });
    const nowSpy = jest.spyOn(performance, 'now').mockReturnValueOnce(1_000).mockReturnValueOnce(9_000);

    try {
      const tree = BookingFlow({
        bookingEnabled: false,
        duffelSandbox: false,
        fareContext: null,
        hotelContext: { ...hotelContext, providerUrl: 'https://www.booking.com/hotel/x?aid=123' },
      });
      const anchors = findElements(tree, element => element.type === 'a');
      const outbound = anchors.find(element => element.props.target === '_blank');
      const backLink = anchors.find(element => element.props.href === '/' && typeof element.props.onClick === 'function');

      (outbound?.props.onClick as (() => void))();
      expect(trackMock).toHaveBeenCalledWith('hotel_handoff_continue_clicked', expect.objectContaining({
        source: 'hotellook',
        partnerHost: 'www.booking.com',
        partnerNamed: true,
      }));

      visibilityState = 'hidden';
      visibilityListener?.();
      visibilityState = 'visible';
      visibilityListener?.();
      visibilityListener?.();

      expect(trackMock).toHaveBeenCalledWith('hotel_handoff_returned', {
        source: 'hotellook',
        partnerHost: 'www.booking.com',
        awayDurationBucket: '5–30s',
      });
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_handoff_returned')).toHaveLength(1);

      (backLink?.props.onClick as (() => void))();
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_handoff_back_clicked')).toHaveLength(0);
    } finally {
      nowSpy.mockRestore();
      if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
      else delete (globalThis as { document?: unknown }).document;
    }
  });

  it('shows a recoverable hotel-specific error for malformed hotel handoff links', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: true,
      fareContext: null,
      hotelContext: null,
      invalidHotelSelection: true,
    });
    const text = collectText(tree);
    const searchLink = findElements(tree, element => element.type === 'a' && element.props.href === '/')[0];

    expect(text).toContain('Hotel review unavailable');
    expect(text).toContain('This hotel link is incomplete, so expaify cannot show a trustworthy property and nightly rate.');
    expect(text).toContain('Search hotels');
    expect(searchLink).toBeDefined();
    expect(text).not.toContain("We can't identify this fare");
  });
});
