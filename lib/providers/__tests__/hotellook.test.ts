/**
 * HotellookProvider tests.
 *
 * All Travelpayouts/Hotellook hotel API endpoints currently return 404.
 * The provider returns { ok: true, data: [] } for every input without
 * making any network calls.
 */

import { HotellookProvider, hotellook } from '../hotellook';

// ─── Mock Redis cache (not used in current implementation) ───────────────────

jest.mock('../../cache/redis', () => ({
  cache: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
}));

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  process.env.TP_TOKEN = 'test-token';
  process.env.TP_AFFILIATE_MARKER = 'marker42';
  jest.clearAllMocks();
  global.fetch = jest.fn();
});

// ─── Core behaviour ───────────────────────────────────────────────────────────

describe('HotellookProvider.searchHotels — API unavailable', () => {
  it('returns { ok: true, data: [] } for a normal city + date search', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('New York', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('returns { ok: true, data: [] } for an IATA code (JFK)', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('returns { ok: true, data: [] } for an IATA code (LAX)', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('LAX', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('returns { ok: true, data: [] } for an IATA code (LHR)', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('LHR', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('returns { ok: true, data: [] } when checkin is missing', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', { checkin: '', checkout: '2026-09-29' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('returns { ok: true, data: [] } when checkout is missing', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('JFK', { checkin: '2026-09-22', checkout: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('returns { ok: true, data: [] } when both dates are missing', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('Paris', { checkin: '', checkout: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('returns { ok: true, data: [] } for an unknown city', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('UnknownCity', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('returns { ok: true, data: [] } for an empty area string', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('makes no network requests regardless of input', async () => {
    const provider = new HotellookProvider();
    await provider.searchHotels('Miami', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('result.data is always a plain array (not null or undefined)', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('Tokyo', {
      checkin: '2026-10-01',
      checkout: '2026-10-07',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(0);
  });

  it('is stable across multiple sequential calls', async () => {
    const provider = new HotellookProvider();
    const inputs = ['New York', 'LAX', 'London', 'UnknownPlace'];

    for (const area of inputs) {
      const result = await provider.searchHotels(area, {
        checkin: '2026-09-22',
        checkout: '2026-09-29',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(result.reason);
      expect(result.data).toEqual([]);
    }
  });

  it('ok is exactly true (boolean), not just truthy', async () => {
    const provider = new HotellookProvider();
    const result = await provider.searchHotels('Berlin', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
  });
});

// ─── Singleton export ─────────────────────────────────────────────────────────

describe('hotellook singleton', () => {
  it('is an instance of HotellookProvider', () => {
    expect(hotellook).toBeInstanceOf(HotellookProvider);
  });

  it('singleton also returns { ok: true, data: [] }', async () => {
    const result = await hotellook.searchHotels('SFO', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(result.data).toEqual([]);
  });

  it('singleton makes no network requests', async () => {
    await hotellook.searchHotels('Chicago', {
      checkin: '2026-09-22',
      checkout: '2026-09-29',
    });

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
