import { FlightProvider, NormalizedFare, PricePoint, Result } from '../types';

export class AmadeusProvider implements FlightProvider {
  async searchFares(
    _origin: string,
    _dest: string,
    _range: { depart: string; return?: string }
  ): Promise<Result<NormalizedFare[]>> {
    return { ok: false, reason: 'Amadeus provider not yet configured' };
  }

  async priceTrends(_origin: string, _dest: string): Promise<Result<PricePoint[]>> {
    return { ok: false, reason: 'Amadeus provider not yet configured' };
  }
}
