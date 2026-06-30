import { travelpayouts } from '../lib/providers/travelpayouts';
import { query } from '../lib/db/client';

interface Alert {
  id: string;
  email: string;
  origin: string;
  destination: string;
  target_cents: number;
}

async function sendAlertEmail(
  email: string,
  origin: string,
  dest: string,
  priceDollars: number,
  targetDollars: number,
): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(
      `[alert] Would email ${email}: ${origin}→${dest} now $${priceDollars} (target $${targetDollars})`,
    );
    return;
  }
  await fetch('https://api.resend.com/emails', {
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
}

async function main(): Promise<void> {
  const alertsResult = await query<Alert>(
    `SELECT id, email, origin, destination, target_cents
     FROM price_alerts
     WHERE active = true AND triggered_at IS NULL`,
  );

  const alerts = alertsResult.rows;
  console.log(`[check-alerts] Found ${alerts.length} active alert(s) to check`);

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
        `[check-alerts] Checked alert ${alert.id} (${label}): min $${minDollars} vs target $${targetDollars} → ${triggered ? 'TRIGGERED' : 'not triggered'}`,
      );

      if (triggered) {
        await sendAlertEmail(alert.email, alert.origin, alert.destination, minDollars, targetDollars);
        await query(
          `UPDATE price_alerts SET triggered_at = now(), active = false, last_checked_at = now() WHERE id = $1`,
          [alert.id],
        );
      } else {
        await query(`UPDATE price_alerts SET last_checked_at = now() WHERE id = $1`, [alert.id]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[check-alerts] ${label} ERROR: ${message}`);
    }
  }

  process.exit(0);
}

main();
