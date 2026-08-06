import { renderToStaticMarkup } from 'react-dom/server';
import { AiDayPlanSection } from '../AiDayPlanSection';
import { getAiDayPlan } from '@/lib/providers/aiTripPlanner';

jest.mock('@/lib/providers/aiTripPlanner', () => ({
  getAiDayPlan: jest.fn(),
}));

describe('AiDayPlanSection', () => {
  it('renders the AI day plan card when the provider succeeds with activities', async () => {
    (getAiDayPlan as jest.Mock).mockResolvedValue({
      ok: true,
      data: {
        destination: 'Barcelona',
        day: 1,
        activities: [{ time: '9:00 AM', description: 'Visit Sagrada Familia' }],
      },
    });

    const html = renderToStaticMarkup(await AiDayPlanSection({ city: 'Barcelona' }));

    expect(html).toContain('AI-suggested day plan for Barcelona');
    expect(html).toContain('Visit Sagrada Familia');
  });

  it('renders nothing when the provider is not configured, instead of showing empty/broken UI', async () => {
    (getAiDayPlan as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'AI Trip Planner not configured',
    });

    const result = await AiDayPlanSection({ city: 'Barcelona' });

    expect(result).toBeNull();
  });

  it('renders nothing when activities come back empty', async () => {
    (getAiDayPlan as jest.Mock).mockResolvedValue({
      ok: true,
      data: { destination: 'Barcelona', day: 1, activities: [] },
    });

    const result = await AiDayPlanSection({ city: 'Barcelona' });
    const html = result ? renderToStaticMarkup(result) : ''

    expect(html).toBe('');
  });
});
