import { getDealDetail, isValidDealId } from '../../../../lib/deals/dealDetail';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ dealId: string }> },
): Promise<Response> {
  const { dealId } = await context.params;

  if (!isValidDealId(dealId)) {
    return Response.json({ error: 'Invalid deal id' }, { status: 400 });
  }

  const deal = await getDealDetail(dealId);
  if (!deal) {
    return Response.json({ error: 'Deal not found' }, { status: 404 });
  }

  return Response.json(deal);
}
