import { renderToStaticMarkup } from 'react-dom/server';
import { LocationQualitySection } from '../LocationQualitySection';
import { getLocationQuality } from '@/lib/providers/locationQuality';

jest.mock('@/lib/providers/locationQuality', () => ({
  getLocationQuality: jest.fn(),
}));

describe('LocationQualitySection', () => {
  it('renders the badge when the provider succeeds', async () => {
    (getLocationQuality as jest.Mock).mockResolvedValue({
      ok: true,
      data: { vibeTag: 'Walkable foodie hub', summary: 'A short walk from 3 highly-rated spots.', poiCount: 3 },
    });

    const html = renderToStaticMarkup(await LocationQualitySection({ hotelName: 'Hotel Test', city: 'Barcelona' }));

    expect(html).toContain('Walkable foodie hub');
    expect(html).toContain('A short walk from 3 highly-rated spots.');
  });

  it('renders nothing (not an error state) when the provider cannot assess the location', async () => {
    (getLocationQuality as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'Not enough nearby points of interest to assess this location.',
    });

    const result = await LocationQualitySection({ hotelName: 'Hotel Test', city: 'Barcelona' });

    expect(result).toBeNull();
  });

  it('renders nothing when location quality is not configured', async () => {
    (getLocationQuality as jest.Mock).mockResolvedValue({ ok: false, reason: 'Location quality is not configured.' });

    const result = await LocationQualitySection({ hotelName: 'Hotel Test', city: 'Barcelona' });

    expect(result).toBeNull();
  });
});
