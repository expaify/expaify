import { travelpayouts } from '../lib/providers/travelpayouts';
import { hotellook } from '../lib/providers/hotellook';
import { query } from '../lib/db/client';
import type { Result } from '../lib/types';

interface FlightAlert {
  id: string;
  email: string;
  origin: string;
  destination: string;
  target_cents: number;
}

interface HotelAlert extends FlightAlert {
  hotel_id: string;
}

async function sendAlertEmail(
  email: string,
  origin: string,
  dest: string,
  priceDollars: number,
  targetDollars: number,
): Promise<Result<true>> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return { ok: false, reason: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'alerts@expaify.com',
        to: email,
        subject: `✈ Price drop: ${origin}→${dest} now $${priceDollars}`,
        html: `<div style="background:#0a0f1e;color:#f9fafb;padding:40px;font-family:system-ui">
          <h1 style="color:#6366f1">expaify price alert</h1>
          <p>${origin} → ${dest} has dropped to <strong>$${priceDollars}</strong> (your target: $${targetDollars})</p>
          <a href="https://expaify.com" style="background:#6366f1;color:white;padding:12px 24px;border-radius:8px;text-decoration:none">Search now →</a>
        </div>`,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      return { ok: false, reason: `Resend HTTP ${response.status}: ${body.slice(0, 200)}` };
    }
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }

  return { ok: true, data: true };
}

function getHotelAlertRange(): { checkin: string; checkout: string } {
  const now = new Date();
  const checkin = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const checkout = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2));

  return {
    checkin: checkin.toISOString().slice(0, 10),
    checkout: checkout.toISOString().slice(0, 10),
  };
}

async function main(): Promise<void> {
  const alertsResult = await query<FlightAlert>(
    `SELECT id, email, origin, destination, target_cents
     FROM price_alerts
     WHERE active = true AND triggered_at IS NULL AND hotel_id IS NULL`,
  );

  const alerts = alertsResult.rows;
  console.log(`[check-alerts] Found ${alerts.length} active flight alert(s) to check`);

  for (const alert of alerts) {
    const label = `${alert.origin}→${alert.destination}`;
    try {
      const result = await travelpayouts.priceTrends(alert.origin, alert.destination);

      if (!result.ok) {
        console.error(`[check-alerts] ${label} ERROR: ${result.reason}`);
        // Still update last_checked_at so we don't skip it next run
        await query(`UPDATE price_alerts SET last_checked_at = now() WHERE id = $1`, [alert.id]);
        continue;
      }

      const points = result.data;
      if (points.length === 0) {
        console.log(`[check-alerts] Checked alert ${alert.id} (${label}): no price data`);
        await query(`UPDATE price_alerts SET last_checked_at = now() WHERE id = $1`, [alert.id]);
        continue;
      }

      const minCents = Math.min(...points.map((p) => p.priceCents));
      const targetDollars = Math.round(alert.target_cents / 100);
      const minDollars = Math.round(minCents / 100);
      const triggered = minCents <= alert.target_cents;

      console.log(
        `[check-alerts] Checked alert ${alert.id} (${label}): min $${minDollars} vs target $${targetDollars} → ${triggered ? 'delivery needed' : 'not triggered'}`,
      );

      if (triggered) {
        const delivery = await sendAlertEmail(
          alert.email,
          alert.origin,
          alert.destination,
          minDollars,
          targetDollars,
        );
        if (!delivery.ok) {
          console.error(`[check-alerts] ${label} delivery unavailable: ${delivery.reason}`);
          await query(`UPDATE price_alerts SET last_checked_at = now() WHERE id = $1`, [alert.id]);
          continue;
        }

        await query(
          `UPDATE price_alerts SET triggered_at = now(), active = false, last_checked_at = now() WHERE id = $1`,
          [alert.id],
        );
        console.log(`[check-alerts] Alert ${alert.id} (${label}) triggered and delivered`);
      } else {
        await query(`UPDATE price_alerts SET last_checked_at = now() WHERE id = $1`, [alert.id]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[check-alerts] ${label} ERROR: ${message}`);
    }
  }

  const hotelAlertsResult = await query<HotelAlert>(
    `SELECT id, email, origin, destination, target_cents, hotel_id
     FROM price_alerts
     WHERE active = true AND triggered_at IS NULL AND hotel_id IS NOT NULL`,
  );

  const hotelAlerts = hotelAlertsResult.rows;
  console.log(`[check-alerts] Found ${hotelAlerts.length} active hotel alert(s) to check`);

  for (const alert of hotelAlerts) {
    const label = `${alert.origin} hotel ${alert.hotel_id}`;
    try {
      const result = await hotellook.searchHotels(alert.origin, getHotelAlertRange());

      if (!result.ok) {
        console.error(`[check-alerts] ${label} ERROR: ${result.reason}`);
        await query(`UPDATE price_alerts SET last_checked_at = now() WHERE id = $1`, [alert.id]);
        continue;
      }

      const match = result.data.offers.find(
        (hotel) =>
          hotel.id === alert.hotel_id &&
          hotel.pricePerNight.priceCents <= alert.target_cents,
      );
      const targetDollars = Math.round(alert.target_cents / 100);

      if (!match) {
        console.log(
          `[check-alerts] Checked alert ${alert.id} (${label}): not triggered`,
        );
        await query(`UPDATE price_alerts SET last_checked_at = now() WHERE id = $1`, [alert.id]);
        continue;
      }

      const priceDollars = Math.round(match.pricePerNight.priceCents / 100);
      console.log(
        `[check-alerts] Checked alert ${alert.id} (${label}): $${priceDollars} vs target $${targetDollars} → delivery needed`,
      );

      const delivery = await sendAlertEmail(
        alert.email,
        alert.origin,
        match.name,
        priceDollars,
        targetDollars,
      );
      if (!delivery.ok) {
        console.error(`[check-alerts] ${label} delivery unavailable: ${delivery.reason}`);
        await query(`UPDATE price_alerts SET last_checked_at = now() WHERE id = $1`, [alert.id]);
        continue;
      }

      await query(
        `UPDATE price_alerts SET triggered_at = now(), active = false, last_checked_at = now() WHERE id = $1`,
        [alert.id],
      );
      console.log(`[check-alerts] Alert ${alert.id} (${label}) triggered and delivered`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[check-alerts] ${label} ERROR: ${message}`);
    }
  }

  process.exit(0);
}

main();
