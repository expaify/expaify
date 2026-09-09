import { travelpayouts } from '../lib/providers/travelpayouts';
import { bookingComHotels } from '../lib/providers/bookingComHotelsRapidApi';
import { query } from '../lib/db/client';
import { completeAlert, flightAlertTotal, type AlertContract } from '../lib/alerts/contract';
import type { Money, Result } from '../lib/types';

export interface PriceAlert extends AlertContract {
  id: string;
  email: string;
  origin: string;
  destination: string;
  target_cents: number;
  active: boolean;
  triggered_at: string | null;
}

export async function alertPrice(alert: PriceAlert): Promise<Money | null> {
  if (!alert.active || alert.triggered_at || !completeAlert(alert) ||
      alert.travel_start < new Date().toISOString().slice(0, 10) ||
      !/^[A-Z]{3}$/.test(alert.origin) || !/^[A-Z]{3}$/.test(alert.destination) ||
      !Number.isSafeInteger(alert.target_cents) || alert.target_cents <= 0) return null;

  if (alert.trip_type === 'hotel') {
    const result = await bookingComHotels.searchHotels(alert.origin, {
      checkin: alert.travel_start, checkout: alert.travel_end!, currency: alert.currency, strictCurrency: true,
    });
    if (!result.ok) return null;
    const hotel = result.data.offers.find(offer =>
      offer.source === alert.hotel_provider && offer.id === alert.hotel_id &&
      offer.pricePerNight.currency === alert.currency &&
      Number.isSafeInteger(offer.pricePerNight.priceCents) && offer.pricePerNight.priceCents > 0 &&
      offer.pricePerNight.priceCents <= alert.target_cents);
    return hotel?.pricePerNight ?? null;
  }

  const result = await travelpayouts.searchFares(alert.origin, alert.destination, {
    depart: alert.travel_start, return: alert.travel_end ?? undefined,
    passengers: alert.passenger_count, currency: alert.currency, strictDates: true,
  });
  if (!result.ok) return null;
  const prices = result.data.flatMap(fare => {
    if (fare.origin !== alert.origin || fare.destination !== alert.destination ||
        fare.depart?.slice(0, 10) !== alert.travel_start ||
        (fare.return?.slice(0, 10) ?? null) !== alert.travel_end ||
        fare.price.currency !== alert.currency || fare.passengerCount !== alert.passenger_count) return [];
    const total = flightAlertTotal(fare);
    return total !== null && total <= alert.target_cents ? [total] : [];
  });
  return prices.length ? { priceCents: Math.min(...prices), currency: alert.currency } : null;
}

function displayMoney(money: Money): string {
  return `${money.currency} ${(money.priceCents / 100).toFixed(2)}`;
}

export async function sendAlertEmail(alert: PriceAlert, price: Money): Promise<Result<true>> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: 'Email delivery not configured' };
  const label = alert.trip_type === 'hotel' ? `Booking.com hotel ${alert.hotel_id}` : `${alert.origin} → ${alert.destination}`;
  const dates = `${alert.travel_start}${alert.travel_end ? ` to ${alert.travel_end}` : ''}`;
  const scope = alert.trip_type === 'hotel' ? 'per night, 2 adults, 1 room' : `party total, ${alert.passenger_count} traveler(s), economy`;
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
        'Idempotency-Key': `price-alert/${alert.id}`,
      },
      body: JSON.stringify({
        from: 'alerts@expaify.com', to: alert.email,
        subject: `Price alert: ${label} now ${displayMoney(price)}`,
        text: `${label} on ${dates} now costs ${displayMoney(price)} (${scope}). Your target: ${displayMoney({ priceCents: alert.target_cents, currency: alert.currency })}. Fares can change before booking. Search at https://expaify.com`,
      }),
    });
    return response.ok ? { ok: true, data: true } : { ok: false, reason: `Email HTTP ${response.status}` };
  } catch {
    return { ok: false, reason: 'Email delivery unavailable' };
  }
}

export async function checkAlerts(options: { dryRun?: boolean; send?: typeof sendAlertEmail } = {}): Promise<void> {
  const result = await query<PriceAlert>(
    `SELECT id, email, origin, destination, target_cents, currency, hotel_id, hotel_provider,
            travel_start::text, travel_end::text, trip_type, passenger_count, active, triggered_at
     FROM price_alerts WHERE active = true AND triggered_at IS NULL
       AND travel_start IS NOT NULL AND trip_type IS NOT NULL AND passenger_count IS NOT NULL
       AND (hotel_id IS NULL OR hotel_provider = 'booking.com')`,
  );
  console.log(`[check-alerts] ${result.rows.length} candidate(s); dry run: ${Boolean(options.dryRun)}`);
  let failures = 0;
  for (const alert of result.rows) {
    if (!alert.active || alert.triggered_at || !completeAlert(alert)) continue;
    try {
      const price = await alertPrice(alert);
      if (options.dryRun) {
        console.log(`[check-alerts] ${alert.id}: ${price ? 'matching quote' : 'no safe match'}`);
        continue;
      }
      if (price) {
        const delivery = await (options.send ?? sendAlertEmail)(alert, price);
        if (!delivery.ok) { failures++; continue; }
        await query('UPDATE price_alerts SET triggered_at = now(), active = false, last_checked_at = now() WHERE id = $1 AND active = true', [alert.id]);
      } else {
        await query('UPDATE price_alerts SET last_checked_at = now() WHERE id = $1', [alert.id]);
      }
    } catch {
      failures++;
      console.warn(`[check-alerts] ${alert.id}: check failed`);
    }
  }
  if (failures) throw new Error(`${failures} alert check(s) failed`);
}

if (require.main === module) {
  checkAlerts({ dryRun: process.argv.includes('--dry-run') })
    .then(() => process.exit(0))
    .catch(() => { console.warn('[check-alerts] Job failed'); process.exit(1); });
}
