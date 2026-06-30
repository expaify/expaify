import { getDealDetail, isValidDealId, dealRowToDetail } from '../dealDetail';
import { query } from '../../db/client';
import type { QueryResult, QueryResultRow } from 'pg';

jest.mock('../../db/client', () => ({
  query: jest.fn(),
}));

const mockedQuery = query as jest.MockedFunction<typeof query>;

function queryResult<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return {
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows,
  };
}

describe('deal detail', () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it('validates URL-safe deal ids', () => {
    expect(isValidDealId('abcDEF12')).toBe(true);
    expect(isValidDealId('deal_123-XYZ')).toBe(true);
    expect(isValidDealId('short')).toBe(false);
    expect(isValidDealId('bad/id/123')).toBe(false);
    expect(isValidDealId('deal.1234')).toBe(false);
  });

  it('does not query the database for invalid ids', async () => {
    await expect(getDealDetail('bad/id/123')).resolves.toBeNull();
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('returns null when a valid deal id is missing', async () => {
    mockedQuery.mockResolvedValueOnce(queryResult([]));

    await expect(getDealDetail('deal_1234')).resolves.toBeNull();
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it('maps database rows to DealDetail', async () => {
    const updatedAt = new Date('2026-06-30T10:00:00.000Z');
    const expiresAt = new Date('2026-07-01T10:00:00.000Z');

    mockedQuery.mockResolvedValueOnce(
      queryResult([
        {
          id: 'deal_1234',
          kind: 'flight',
          title: 'New York to Lisbon',
          subtitle: 'Round trip from JFK to LIS',
          provider: 'Duffel',
          price_cents: 42800,
          currency: 'usd',
          deal_score: '14.8',
          image_url: 'https://example.com/lisbon.jpg',
          booking_url: 'https://example.com/book',
          expires_at: expiresAt,
          updated_at: updatedAt,
          metadata: {
            origin: 'JFK',
            destination: 'LIS',
            stops: 0,
            refundable: false,
            ignored: { nested: true },
            empty: null,
          },
        },
      ]),
    );

    await expect(getDealDetail('deal_1234')).resolves.toEqual({
      id: 'deal_1234',
      kind: 'flight',
      title: 'New York to Lisbon',
      subtitle: 'Round trip from JFK to LIS',
      provider: 'Duffel',
      price: 42800,
      currency: 'USD',
      dealScore: 14.8,
      imageUrl: 'https://example.com/lisbon.jpg',
      bookingUrl: 'https://example.com/book',
      expiresAt: expiresAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
      metadata: {
        origin: 'JFK',
        destination: 'LIS',
        stops: 0,
        refundable: false,
        empty: null,
      },
    });
  });

  it('returns null for incomplete database rows', () => {
    expect(dealRowToDetail({ id: 'deal_1234', kind: 'flight' })).toBeNull();
  });
});
