import { renderToStaticMarkup } from 'react-dom/server';
import { AiDayPlanSection } from '../AiDayPlanSection';
import { getAiDayPlan } from '@/lib/providers/aiTripPlanner';

jest.mock('@/lib/providers/aiTripPlanner', () => ({
  getAiDayPlan: jest.fn(),
}));

describe('AiDayPlanSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('renders a visible unavailable status, not nothing, when the provider is not configured', async () => {
    (getAiDayPlan as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'AI Trip Planner not configured',
    });

    const result = await AiDayPlanSection({ city: 'Barcelona' });
    expect(result).not.toBeNull();

    const html = renderToStaticMarkup(result);

    expect(html).toContain('role="status"');
    expect(html).toContain('AI-suggested day plan');
    expect(html).toContain('Day plan unavailable');
    expect(html).toContain('Barcelona');
  });

  it('renders a visible unavailable status, not nothing, when the provider errors', async () => {
    (getAiDayPlan as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'AI Trip Planner HTTP 500',
    });

    const result = await AiDayPlanSection({ city: 'Tokyo' });
    expect(result).not.toBeNull();

    const html = renderToStaticMarkup(result);

    expect(html).toContain('role="status"');
    expect(html).toContain('Day plan unavailable');
    expect(html).toContain('Tokyo');
  });

  it('renders a visible unavailable status, not nothing, when activities come back empty', async () => {
    (getAiDayPlan as jest.Mock).mockResolvedValue({
      ok: true,
      data: { destination: 'Barcelona', day: 1, activities: [] },
    });

    const result = await AiDayPlanSection({ city: 'Barcelona' });
    expect(result).not.toBeNull();

    const html = renderToStaticMarkup(result);

    expect(html).toContain('role="status"');
    expect(html).toContain('Day plan unavailable');
    expect(html).toContain('Barcelona');
  });

  it('does not fabricate activities in the unavailable state', async () => {
    (getAiDayPlan as jest.Mock).mockResolvedValue({
      ok: false,
      reason: 'AI Trip Planner not configured',
    });

    const result = await AiDayPlanSection({ city: 'Barcelona' });
    const html = renderToStaticMarkup(result);

    expect(html).not.toContain('<ol');
    expect(html).not.toContain('9:00 AM');
  });

  it('renders nothing for a blank city, since there is nothing to plan around', async () => {
    const result = await AiDayPlanSection({ city: '   ' });

    expect(result).toBeNull();
    expect(getAiDayPlan).not.toHaveBeenCalled();
  });
});
