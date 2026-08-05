import {
  HOTEL_STAY_RETENTION_DAYS,
  HOTEL_STAY_STORE_KEY,
  HOTEL_STAY_STORE_LIMIT,
  getStayStubSnapshot,
  isStayStorageAvailable,
  readStayStub,
  subscribeToStayStoreChanges,
  writeStayStub,
  type HotelStayStub,
} from '../hotelStayStore';

function createMemoryStorage(overrides: Partial<Storage> = {}): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
    ...overrides,
  } as Storage;
}

function baseStub(overrides: Partial<HotelStayStub> = {}): HotelStayStub {
  return {
    v: 1,
    offerId: 'hotel_offer_1',
    provider: 'hotellook',
    partnerHost: 'booking.com',
    partnerLabel: 'Booking.com',
    name: 'The Example Hotel',
    areaLabel: 'Midtown',
    priceCents: 18_900,
    currency: 'USD',
    priceBasis: 'per_night_before_taxes_fees',
    providerUrl: 'https://www.booking.com/hotel/x?aid=123',
    declaredBookedAt: new Date().toISOString(),
    handoffAttemptId: 'a1b2c3d4-e5f6-4789-a012-3456789abcde',
    ...overrides,
  };
}

describe('hotel stay stub store', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  function installWindow(storage: Storage | undefined) {
    Object.defineProperty(globalThis, 'window', {
      value: storage === undefined ? undefined : { localStorage: storage },
      configurable: true,
    });
  }

  afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete (globalThis as { window?: unknown }).window;
  });

  it('reports storage unavailable with no window and never throws', () => {
    installWindow(undefined);
    expect(isStayStorageAvailable()).toBe(false);
    expect(readStayStub('any')).toBeNull();
    expect(writeStayStub(baseStub())).toEqual({ ok: false, reason: 'Storage is not available in this environment.' });
  });

  it('reports storage unavailable when the probe write throws (e.g. Safari private mode)', () => {
    installWindow(createMemoryStorage({
      setItem: () => { throw new Error('QuotaExceededError') },
    }));
    expect(isStayStorageAvailable()).toBe(false);
  });

  it('writes and reads back a stub by offerId, keyed under the versioned key', () => {
    const storage = createMemoryStorage();
    installWindow(storage);
    const stub = baseStub();

    expect(writeStayStub(stub)).toEqual({ ok: true });
    expect(readStayStub(stub.offerId)).toEqual(stub);
    expect(readStayStub('some-other-offer')).toBeNull();
    expect(JSON.parse(storage.getItem(HOTEL_STAY_STORE_KEY)!)).toEqual([stub]);
  });

  it('never throws when the underlying write fails, and surfaces a Result failure', () => {
    installWindow(createMemoryStorage({
      setItem: () => { throw new Error('QuotaExceededError') },
    }));
    expect(() => writeStayStub(baseStub())).not.toThrow();
    expect(writeStayStub(baseStub())).toEqual({ ok: false, reason: 'Storage write failed.' });
  });

  it('replaces an existing offerId in place without evicting anything', () => {
    installWindow(createMemoryStorage());
    const original = baseStub({ priceCents: 10_000 });
    const updated = baseStub({ priceCents: 20_000 });

    writeStayStub(original);
    writeStayStub(updated);

    expect(readStayStub(original.offerId)).toEqual(updated);
  });

  it('evicts exactly the single oldest stub by declaredBookedAt when an 11th distinct offer is written', () => {
    installWindow(createMemoryStorage());
    const now = Date.now();
    // Spread within the retention window (hours apart, not months) so this
    // test isolates eviction-by-capacity from expiry-by-retention.
    const stubs = Array.from({ length: HOTEL_STAY_STORE_LIMIT }, (_, index) => baseStub({
      offerId: `offer-${index}`,
      declaredBookedAt: new Date(now - (HOTEL_STAY_STORE_LIMIT - index) * 3_600_000).toISOString(),
    }));
    stubs.forEach(stub => writeStayStub(stub));

    const eleventh = baseStub({ offerId: 'offer-eleventh', declaredBookedAt: new Date(now).toISOString() });
    writeStayStub(eleventh);

    expect(readStayStub('offer-0')).toBeNull(); // oldest by declaredBookedAt
    expect(readStayStub('offer-1')).not.toBeNull();
    expect(readStayStub('offer-eleventh')).not.toBeNull();
  });

  it('treats a stub past retention as expired: 180 days after checkOut when dates are present', () => {
    installWindow(createMemoryStorage());
    const now = Date.now();
    const justExpired = baseStub({
      offerId: 'dated-offer',
      checkIn: new Date(now - (HOTEL_STAY_RETENTION_DAYS + 2) * 86_400_000).toISOString().slice(0, 10),
      checkOut: new Date(now - (HOTEL_STAY_RETENTION_DAYS + 1) * 86_400_000).toISOString().slice(0, 10),
      nightCount: 1,
    });
    writeStayStub(justExpired);

    expect(readStayStub('dated-offer')).toBeNull();
  });

  it('treats a stub past retention as expired: 180 days after declaredBookedAt when dates are absent', () => {
    installWindow(createMemoryStorage());
    const now = Date.now();
    const justExpired = baseStub({
      offerId: 'undated-offer',
      declaredBookedAt: new Date(now - (HOTEL_STAY_RETENTION_DAYS + 1) * 86_400_000).toISOString(),
    });
    writeStayStub(justExpired);

    expect(readStayStub('undated-offer')).toBeNull();
  });

  it('keeps a stub that has not yet reached retention', () => {
    installWindow(createMemoryStorage());
    const now = Date.now();
    const stillFresh = baseStub({
      offerId: 'fresh-offer',
      declaredBookedAt: new Date(now - (HOTEL_STAY_RETENTION_DAYS - 1) * 86_400_000).toISOString(),
    });
    writeStayStub(stillFresh);

    expect(readStayStub('fresh-offer')).toEqual(stillFresh);
  });

  it('treats corrupt JSON as an absent store rather than surfacing a parse error', () => {
    installWindow(createMemoryStorage());
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: createMemoryStorage() },
      configurable: true,
    });
    (globalThis.window.localStorage as Storage).setItem(HOTEL_STAY_STORE_KEY, '{not valid json');

    expect(() => readStayStub('anything')).not.toThrow();
    expect(readStayStub('anything')).toBeNull();

    // The next successful write overwrites the corrupt value rather than merging with it.
    const stub = baseStub();
    expect(writeStayStub(stub)).toEqual({ ok: true });
    expect(readStayStub(stub.offerId)).toEqual(stub);
  });

  it('treats a store holding a foreign shape (wrong version, non-integer cents) as absent', () => {
    installWindow(createMemoryStorage());
    globalThis.window.localStorage.setItem(HOTEL_STAY_STORE_KEY, JSON.stringify([
      { v: 2, offerId: 'wrong-version' },
    ]));
    expect(readStayStub('wrong-version')).toBeNull();

    globalThis.window.localStorage.setItem(HOTEL_STAY_STORE_KEY, JSON.stringify([
      { ...baseStub(), priceCents: 189.5 },
    ]));
    expect(readStayStub('hotel_offer_1')).toBeNull();
  });

  it('never stores a float in priceCents or a non-3-letter currency', () => {
    installWindow(createMemoryStorage());
    const stub = baseStub({ priceCents: 18_900, currency: 'USD' });
    writeStayStub(stub);
    const stored = JSON.parse(globalThis.window.localStorage.getItem(HOTEL_STAY_STORE_KEY)!) as HotelStayStub[];

    expect(Number.isInteger(stored[0].priceCents)).toBe(true);
    expect(stored[0].currency).toMatch(/^[A-Z]{3}$/);
  });
});

describe('useSyncExternalStore integration', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  function installWindow(storage: Storage | undefined) {
    Object.defineProperty(globalThis, 'window', {
      value: storage === undefined ? undefined : { localStorage: storage, addEventListener: jest.fn(), removeEventListener: jest.fn() },
      configurable: true,
    });
  }

  afterEach(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete (globalThis as { window?: unknown }).window;
  });

  describe('getStayStubSnapshot', () => {
    it('returns a referentially stable value across calls when the underlying store has not changed', () => {
      installWindow(createMemoryStorage());
      writeStayStub(baseStub());

      const first = getStayStubSnapshot('hotel_offer_1');
      const second = getStayStubSnapshot('hotel_offer_1');

      expect(first).not.toBeNull();
      expect(first).toBe(second); // same object reference — required by useSyncExternalStore
    });

    it('returns a new value once the underlying store changes', () => {
      installWindow(createMemoryStorage());
      writeStayStub(baseStub({ priceCents: 10_000 }));
      const before = getStayStubSnapshot('hotel_offer_1');

      writeStayStub(baseStub({ priceCents: 20_000 }));
      const after = getStayStubSnapshot('hotel_offer_1');

      expect(before?.priceCents).toBe(10_000);
      expect(after?.priceCents).toBe(20_000);
      expect(before).not.toBe(after);
    });

    it('returns null, stably, with no window', () => {
      installWindow(undefined);
      expect(getStayStubSnapshot('hotel_offer_1')).toBeNull();
      expect(getStayStubSnapshot('hotel_offer_1')).toBeNull();
    });
  });

  describe('subscribeToStayStoreChanges', () => {
    it('registers and unregisters a native storage listener', () => {
      const addEventListener = jest.fn();
      const removeEventListener = jest.fn();
      Object.defineProperty(globalThis, 'window', {
        value: { addEventListener, removeEventListener },
        configurable: true,
      });

      const unsubscribe = subscribeToStayStoreChanges(() => {});
      expect(addEventListener).toHaveBeenCalledWith('storage', expect.any(Function));

      unsubscribe();
      expect(removeEventListener).toHaveBeenCalledWith('storage', expect.any(Function));
    });

    it('is a no-op with no window and never throws', () => {
      installWindow(undefined);
      expect(() => subscribeToStayStoreChanges(() => {})()).not.toThrow();
    });

    it('notifies only for this store\'s key, or a full-clear event', () => {
      const listeners: Array<(event: { key: string | null }) => void> = [];
      const addEventListener = jest.fn((_event: string, listener: (event: { key: string | null }) => void) => {
        listeners.push(listener);
      });
      Object.defineProperty(globalThis, 'window', {
        value: { addEventListener, removeEventListener: jest.fn() },
        configurable: true,
      });
      const onChange = jest.fn();
      subscribeToStayStoreChanges(onChange);

      listeners[0]({ key: 'some-other-app-key' });
      expect(onChange).not.toHaveBeenCalled();

      listeners[0]({ key: HOTEL_STAY_STORE_KEY });
      expect(onChange).toHaveBeenCalledTimes(1);

      listeners[0]({ key: null }); // storage.clear()
      expect(onChange).toHaveBeenCalledTimes(2);
    });
  });
});
