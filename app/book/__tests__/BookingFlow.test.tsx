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
  documentReadiness: {
    status: 'not_provided', scope: 'rate', documentTypes: [], issuerByDocument: {},
    billingDetailsStep: 'unknown', source: { label: 'Hotellook' },
  },
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

    expect(text).toContain('Review selected hotel');
    expect(text).toContain('The Example Hotel');
    expect(text).toContain('Area');
    expect(text).toContain('Midtown');
    expect(text).toContain('Provider supplied an area, not a street address.');
    expect(text).toContain('Location precision');
    expect(text).toContain('Rate source');
    expect(text).toContain('Hotellook');
    expect(text).toContain('$189.00');
    expect(text).toContain('USD');
    expect(text).toContain('per night before taxes and fees');
    expect(text).toContain('You’ll book with an external booking partner.');
    expect(text).toContain('Continue to booking partner');
    expect(text).toContain('Rate freshness not available from this provider.');
    expect(text).toContain('Rate restrictions');
    expect(text).toContain('Restrictions not provided');
    expect(text).toContain('Hotellook did not provide complete rate restrictions. Check membership, residency, age, and refund terms before paying.');
    expect(text).toContain('Source: Hotellook. Rate-detail freshness not available.');
    expect(text).toContain('the total you see there may differ.');
    expect(text).toContain('expaify shows');
    expect(text).toContain('Booking partner confirms');
    expect(text).toContain('I need an invoice or receipt for this stay');
    expect(text).toContain('We’ll show what the provider supplied before you continue.');
    expect(text).not.toContain('Hotellook did not provide invoice or receipt information for this rate.');
    expect(text).toContain('What you may need');
    expect(text).toContain('Have the lead guest’s full name, a confirmation email, and a reachable phone number ready. The booking partner will show exactly what is required.');
    expect(text).toContain('Booking for someone else? Use the name of the person checking in as the lead guest. The booking partner will tell you whose email and phone it needs.');
    expect(text).toContain('Special requests');
    expect(text).toContain('Need a quiet room, high floor, or early check-in?');
    expect(text).toContain('Add your request on the booking partner’s site while booking. Nothing is selected or sent by expaify.');
    expect(text).toContain('Requests depend on availability and are not guaranteed. After booking, use your confirmation or itinerary to contact the property and ask it to confirm what it can provide.');
    expect(text).toContain('Opens the booking partner’s site in a new tab. Your expaify search stays open here.');
    expect(text).not.toContain('Provider confirmation required');
    expect(text).not.toContain('Before you continue');
    expect(text).not.toContain('Provider confirms final total, taxes, fees, room availability, cancellation policy, and terms.');
    expect(text).not.toContain('tp.media takes payment');
    expect(text).not.toContain('Add your request on tp.media');
    expect(text).not.toContain('rooms near each other');
    expect(text).not.toContain('connecting rooms');
    expect(text).not.toContain('Traveler details');
    expect(text).not.toContain('What you’ll need');
    expect(text).not.toContain('Confirm booking');

    const outbound = findElements(tree, element => element.type === 'a' && element.props.target === '_blank')[0];
    expect(outbound.props.href).toBe(hotelContext.providerUrl);
    expect(outbound.props.rel).toBe('noopener noreferrer sponsored');
    expect(outbound.props['aria-label']).toBe("Continue to booking partner for The Example Hotel. Opens the booking partner’s site in a new tab. The selected nightly rate is $189.00, per night before taxes and fees. The final total may differ. Hotellook did not provide complete rate restrictions. Check the partner's terms before paying. Parking space not confirmed.");
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

    expect(text).toContain('You’ll book with Booking.com.');
    expect(text).toContain('Continue to Booking.com');
    expect(text).toContain('Booking.com confirms');
    expect(text).toContain('Add your request on Booking.com while booking. Nothing is selected or sent by expaify.');
    expect(text).toContain('The booking partner will show exactly what is required.');
    expect(text).not.toContain('Booking.com requires');
    expect(text).not.toContain('What you’ll need');
    expect(outbound.props.href).toBe(providerUrl);
    expect(outbound.props.target).toBe('_blank');
    expect(outbound.props.rel).toBe('noopener noreferrer sponsored');
  });

  it('uses a native, initially collapsed disclosure with exact evidence-state semantics', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext: { ...hotelContext, providerUrl: 'https://www.booking.com/hotel/x?aid=123' },
    });
    const details = findElements(tree, element => element.type === 'details')[0];
    const summary = findElements(details, element => element.type === 'summary')[0];
    const list = findElements(details, element => element.type === 'ul')[0];
    const items = findElements(list, element => element.type === 'li');

    expect(details.props.open).toBeUndefined();
    expect(typeof details.props.onToggle).toBe('function');
    expect(collectText(summary)).toBe('How requests work');
    expect(items.map(collectText)).toEqual([
      'Selected: You have chosen a preference. expaify does not offer this step.',
      'Sent: The booking service says it submitted the request. Continuing from expaify does not send one.',
      'Acknowledged: The property has replied about the request.',
      'Guaranteed: The property explicitly confirms it for this stay. Until then, treat it as a preference.',
    ]);
    expect(findElements(details, element => element.type === 'button')).toHaveLength(0);
    expect(summary.props.className).toContain('min-h-11');
  });

  it('keeps invoice intent and traveler readiness before Special requests and the provider CTA', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const panel = findElements(tree, element => (
      element.type === 'div'
      && collectText(element).includes('You’ll book with an external booking partner.')
      && collectText(element).includes('expaify shows')
      && collectText(element).includes('Continue to booking partner')
    )).at(-1) as TestElement;
    const directChildren = childrenOf(panel).filter(child => child && typeof child === 'object') as TestElement[];
    const responsibilityIndex = directChildren.findIndex(child => collectText(child).includes('expaify shows'));
    const invoiceIntentIndex = directChildren.findIndex(child => collectText(child).includes('I need an invoice or receipt for this stay'));
    const readinessIndex = directChildren.findIndex(child => child.type === 'section' && child.props['aria-labelledby'] === 'hotel-traveler-readiness-title');
    const guidanceIndex = directChildren.findIndex(child => child.type === 'section' && collectText(child).includes('Special requests'));
    const actionsIndex = directChildren.findIndex(child => collectText(child).includes('Continue to booking partner'));

    expect(responsibilityIndex).toBeGreaterThanOrEqual(0);
    expect(invoiceIntentIndex).toBeGreaterThan(responsibilityIndex);
    expect(readinessIndex).toBeGreaterThan(invoiceIntentIndex);
    expect(guidanceIndex).toBeGreaterThan(readinessIndex);
    expect(actionsIndex).toBeGreaterThan(guidanceIndex);
  });

  it('renders traveler readiness as static, neutrally styled supporting guidance', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const readiness = findElements(tree, element => (
      element.type === 'section'
      && element.props['aria-labelledby'] === 'hotel-traveler-readiness-title'
    ))[0];
    const headings = findElements(readiness, element => element.type === 'h3');

    expect(readiness).toBeDefined();
    expect(readiness.props.className).toContain('bg-[color:var(--bg-raised)]');
    expect(readiness.props.className).toContain('sm:px-4');
    expect(readiness.props.className).toContain('sm:py-4');
    expect(readiness.props.role).toBeUndefined();
    expect(readiness.props['aria-live']).toBeUndefined();
    expect(readiness.props.tabIndex).toBeUndefined();
    expect(headings).toHaveLength(1);
    expect(headings[0].props.id).toBe('hotel-traveler-readiness-title');
    expect(findElements(readiness, element => ['input', 'button', 'a', 'details'].includes(String(element.type)))).toHaveLength(0);
  });

  it.each([
    ['search_area', 'Only the searched destination is available. Confirm location with the provider.'],
    ['missing', 'No provider location details were returned.'],
  ] as const)('preserves the %s location warning without disabling handoff', (precision, warning) => {
    const contextualHotel: BookingHotelContext = {
      ...hotelContext,
      area: undefined,
      location: precision === 'search_area'
        ? { precision, label: 'New York', source: 'search_fallback' }
        : { precision, source: 'unavailable' },
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

  it('emits one coarse invoice-need event and starts one provider-backed check for a rapid duplicate change', async () => {
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ ok: true, data: hotelContext.documentReadiness }),
    });
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, configurable: true });

    try {
      const tree = BookingFlow({
        bookingEnabled: false,
        duffelSandbox: false,
        fareContext: null,
        hotelContext,
      });
      const checkbox = findElements(tree, element => element.type === 'input' && element.props.type === 'checkbox')[0];
      const change = checkbox.props.onChange as (event: unknown) => void;

      change({ currentTarget: { checked: true } });
      change({ currentTarget: { checked: true } });
      await Promise.resolve();
      await Promise.resolve();

      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_invoice_need_changed')).toEqual([
        ['hotel_invoice_need_changed', { needed: true, source: 'hotellook', partnerNamed: false }],
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const request = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(String(request.body))).toEqual({ hotelContext });
      expect(String(request.body)).toContain('marker=hotel-marker');
      expect(String(request.body)).not.toContain('email');
    } finally {
      if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
      else delete (globalThis as { fetch?: unknown }).fetch;
    }
  });

  it('normalizes unrecognized provider values before emitting invoice analytics', () => {
    const originalFetch = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
    Object.defineProperty(globalThis, 'fetch', {
      value: jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ ok: true, data: hotelContext.documentReadiness }),
      }),
      configurable: true,
    });
    const contextualHotel: BookingHotelContext = {
      ...hotelContext,
      provider: 'property-name-must-not-leak',
    };
    try {
      const tree = BookingFlow({
        bookingEnabled: false,
        duffelSandbox: false,
        fareContext: null,
        hotelContext: contextualHotel,
      });
      const checkbox = findElements(tree, element => element.type === 'input' && element.props.type === 'checkbox')[0];

      (checkbox.props.onChange as (event: unknown) => void)({ currentTarget: { checked: true } });

      expect(trackMock).toHaveBeenCalledWith('hotel_invoice_need_changed', {
        needed: true,
        source: 'other',
        partnerNamed: false,
      });
    } finally {
      if (originalFetch) Object.defineProperty(globalThis, 'fetch', originalFetch);
      else delete (globalThis as { fetch?: unknown }).fetch;
    }
  });

  it('guards request analytics behind sustained guidance exposure and uses non-sensitive properties', () => {
    jest.useFakeTimers();
    let intersectionCallback: IntersectionObserverCallback | undefined;
    let observedTarget: Element | undefined;
    const disconnect = jest.fn();
    const originalObserver = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver');
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: jest.fn((callback: IntersectionObserverCallback) => {
        intersectionCallback = callback;
        return {
          observe: jest.fn((target: Element) => { observedTarget = target; }),
          disconnect,
        };
      }),
    });

    try {
      const providerUrl = 'https://www.booking.com/hotel/private-name?aid=secret-marker';
      const tree = BookingFlow({
        bookingEnabled: false,
        duffelSandbox: false,
        fareContext: null,
        hotelContext: { ...hotelContext, providerUrl },
      });
      const rendered = resolveFunctionElement(tree as TestElement);
      const outbound = findElements(rendered, element => element.type === 'a' && element.props.target === '_blank')[0];
      const details = findElements(rendered, element => element.type === 'details')[0];

      (outbound.props.onClick as (() => void))();
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_request_handoff_continued')).toHaveLength(0);

      intersectionCallback?.([{
        target: observedTarget,
        isIntersecting: true,
        intersectionRatio: 0.5,
      } as IntersectionObserverEntry], {} as IntersectionObserver);
      jest.advanceTimersByTime(999);
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_request_guidance_viewed')).toHaveLength(0);

      intersectionCallback?.([{
        target: observedTarget,
        isIntersecting: false,
        intersectionRatio: 0,
      } as IntersectionObserverEntry], {} as IntersectionObserver);
      jest.advanceTimersByTime(1);
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_request_guidance_viewed')).toHaveLength(0);

      intersectionCallback?.([{
        target: observedTarget,
        isIntersecting: true,
        intersectionRatio: 0.75,
      } as IntersectionObserverEntry], {} as IntersectionObserver);
      jest.advanceTimersByTime(1_000);
      expect(trackMock).toHaveBeenCalledWith('hotel_request_guidance_viewed', {
        source: 'hotellook',
        partnerHost: 'www.booking.com',
        capabilityState: 'provider_directed_only',
        eligibleRequestCount: 3,
      });

      intersectionCallback?.([{
        target: observedTarget,
        isIntersecting: true,
        intersectionRatio: 1,
      } as IntersectionObserverEntry], {} as IntersectionObserver);
      jest.advanceTimersByTime(1_000);
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_request_guidance_viewed')).toHaveLength(1);

      (details.props.onToggle as (event: unknown) => void)({ currentTarget: { open: true } });
      (details.props.onToggle as (event: unknown) => void)({ currentTarget: { open: true } });
      (details.props.onToggle as (event: unknown) => void)({ currentTarget: { open: false } });
      (details.props.onToggle as (event: unknown) => void)({ currentTarget: { open: true } });
      expect(trackMock.mock.calls.filter(([event]) => event === 'hotel_request_help_opened')).toEqual([
        ['hotel_request_help_opened', {
          source: 'hotellook',
          partnerHost: 'www.booking.com',
          capabilityState: 'provider_directed_only',
        }],
        ['hotel_request_help_opened', {
          source: 'hotellook',
          partnerHost: 'www.booking.com',
          capabilityState: 'provider_directed_only',
        }],
      ]);

      (outbound.props.onClick as (() => void))();
      expect(trackMock).toHaveBeenCalledWith('hotel_request_handoff_continued', {
        source: 'hotellook',
        partnerHost: 'www.booking.com',
        capabilityState: 'provider_directed_only',
        eligibleRequestCount: 3,
        selectedRequestCount: 0,
        guidanceSeen: true,
      });
      const requestPayloads = trackMock.mock.calls
        .filter(([event]) => String(event).startsWith('hotel_request_'))
        .map(([, props]) => JSON.stringify(props));
      expect(requestPayloads.join(' ')).not.toContain('private-name');
      expect(requestPayloads.join(' ')).not.toContain('secret-marker');
      expect(requestPayloads.join(' ')).not.toContain('The Example Hotel');
      expect(requestPayloads.join(' ')).not.toContain('hotel_123');
    } finally {
      jest.useRealTimers();
      if (originalObserver) Object.defineProperty(globalThis, 'IntersectionObserver', originalObserver);
      else delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver;
    }
  });

  it('does not let analytics failures block request help or provider handoff', () => {
    const tree = BookingFlow({
      bookingEnabled: false,
      duffelSandbox: false,
      fareContext: null,
      hotelContext,
    });
    const rendered = resolveFunctionElement(tree as TestElement);
    const details = findElements(rendered, element => element.type === 'details')[0];
    const outbound = findElements(rendered, element => element.type === 'a' && element.props.target === '_blank')[0];
    trackMock.mockImplementation(() => { throw new Error('analytics unavailable'); });

    expect(() => (details.props.onToggle as (event: unknown) => void)({ currentTarget: { open: true } })).not.toThrow();
    expect(() => (outbound.props.onClick as (() => void))()).not.toThrow();

    trackMock.mockReset();
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

    expect(text).toContain("We can't identify this hotel");
    expect(text).toContain('integer-cent price, currency, price basis, and provider handoff URL');
    expect(text).toContain('Back to search');
    expect(text).not.toContain("We can't identify this fare");
    expect(text).not.toContain('What you may need');
    expect(text).not.toContain('Special requests');
    expect(findElements(tree, element => element.type === 'details')).toHaveLength(0);
    expect(findElements(tree, element => element.type === 'a' && element.props.target === '_blank')).toHaveLength(0);
    expect(trackMock.mock.calls.some(([event]) => String(event).startsWith('hotel_request_'))).toBe(false);
  });
});
