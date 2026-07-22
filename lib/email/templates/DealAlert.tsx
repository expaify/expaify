import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Img, Preview, Section, Text, Row, Column,
} from '@react-email/components'

export type DealAlertProps = {
  hotelName: string
  city: string
  stars: number
  photoUrl?: string | null
  checkInWindow: string
  discountPct: number
  dealPriceCents: number
  medianPriceCents: number
  snapshotCount: number
  dealUrl: string
  manageUrl: string
  unsubscribeUrl: string
  stopCityUrl?: string | null
  // Optional until DEV-WATCHLIST-UX-01 wires token-authenticated management URLs.
  switchDailyUrl?: string | null
}

function fmt(cents: number) {
  return `$${Math.round(cents / 100)}`
}

function stars(n: number) {
  return '★'.repeat(Math.min(5, Math.max(0, Math.round(n))))
}

export function DealAlert({
  hotelName,
  city,
  stars: starCount,
  photoUrl,
  checkInWindow,
  discountPct,
  dealPriceCents,
  medianPriceCents,
  snapshotCount,
  dealUrl,
  manageUrl,
  unsubscribeUrl,
  stopCityUrl,
  switchDailyUrl,
}: DealAlertProps) {
  return (
    <Html>
      <Head />
      <Preview>{`${hotelName} — ${discountPct}% off in ${city}`}</Preview>
      <Body style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '540px', margin: '0 auto', padding: '32px 20px' }}>

          {/* Logo */}
          <Text style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: '20px', color: '#0E5A54', margin: '0 0 28px' }}>
            expaify<span style={{ color: '#FF6B4A' }}>.</span>
          </Text>

          <Text style={{ fontSize: '13px', color: '#5C5852', margin: '0 0 4px', lineHeight: '20px' }}>
            We found a deal for you
          </Text>

          {/* Deal card */}
          <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', border: '0.5px solid #E8E2D8', overflow: 'hidden', margin: '0 0 20px' }}>
            {photoUrl ? (
              <Img
                src={photoUrl}
                alt=""
                width="540"
                height="216"
                style={{ display: 'block', width: '100%', maxWidth: '540px', height: 'auto' }}
              />
            ) : null}
            <Section style={{ padding: '20px' }}>
            <Row>
              <Column>
                <Heading as="h2" style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 700, color: '#141210', margin: '0 0 4px' }}>
                  {hotelName}
                </Heading>
                <Text style={{ fontSize: '13px', color: '#8A857D', margin: '0 0 12px' }}>
                  {stars(starCount)} · {city} · {checkInWindow}
                </Text>
              </Column>
              <Column style={{ textAlign: 'right', verticalAlign: 'top' }}>
                <Text style={{ display: 'inline-block', backgroundColor: '#D9A441', color: '#412402', fontWeight: 700, fontSize: '14px', padding: '4px 10px', borderRadius: '999px', margin: 0 }}>
                  −{discountPct}%
                </Text>
              </Column>
            </Row>

            <Row style={{ marginBottom: '16px' }}>
              <Column>
                <Text style={{ margin: 0 }}>
                  <span style={{ fontSize: '26px', fontWeight: 700, color: '#0E5A54' }}>{fmt(dealPriceCents)}</span>
                  <span style={{ fontSize: '11px', color: '#8A857D' }}> / night</span>
                  {'  '}
                  <span style={{ fontSize: '14px', color: '#8A857D', textDecoration: 'line-through' }}>
                    usually {fmt(medianPriceCents)}
                  </span>
                </Text>
              </Column>
            </Row>

            <Text style={{ fontSize: '13px', color: '#5C5852', lineHeight: '20px', margin: '0 0 14px' }}>
              This is {fmt(dealPriceCents)} vs a usual {fmt(medianPriceCents)} median for comparable dates.
            </Text>

            <Button
              href={dealUrl}
              style={{
                display: 'block',
                backgroundColor: '#FF6B4A',
                color: '#FFFFFF',
                textDecoration: 'none',
                textAlign: 'center',
                fontWeight: 600,
                fontSize: '14px',
                padding: '12px 24px',
                borderRadius: '999px',
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              See the deal
            </Button>
            </Section>
          </Section>

          <Text style={{ fontSize: '11px', color: '#8A857D', margin: '0 0 20px' }}>
            Based on {snapshotCount} price checks over 60 days · expaify never adds fees
          </Text>

          <Hr style={{ border: 'none', borderTop: '1px solid #E8E2D8', margin: '0 0 16px' }} />

          {switchDailyUrl ? (
            <Text style={{ fontSize: '11px', color: '#8A857D', margin: '0 0 8px' }}>
              Getting too many emails?{' '}
              {stopCityUrl ? (
                <>
                  <a href={stopCityUrl} style={{ color: '#8A857D' }}>Stop alerts for {city}</a>
                  {' · '}
                </>
              ) : null}
              <a href={switchDailyUrl} style={{ color: '#8A857D' }}>Switch to daily digest</a>
            </Text>
          ) : null}

          <Text style={{ fontSize: '11px', color: '#8A857D', margin: 0 }}>
            <a href={manageUrl} style={{ color: '#8A857D' }}>Manage prefs</a>
            {' · '}
            <a href={unsubscribeUrl} style={{ color: '#8A857D' }}>Unsubscribe</a>
            {' · '}
            <a href="https://expaify.com" style={{ color: '#8A857D' }}>expaify.com</a>
            {' · © 2026 expaify'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default DealAlert
