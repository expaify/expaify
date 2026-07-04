import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Img, Preview, Section, Text, Row, Column,
} from '@react-email/components'

export type DigestDeal = {
  id: string
  hotelName: string
  city: string
  stars: number | null
  photoUrl: string | null
  discountPct: number
  dealPriceCents: number
  medianPriceCents: number
  checkInWindow: string
  snapshotCount: number
  dealUrl: string
}

export type DailyDigestProps = {
  deals: DigestDeal[]
  date: string
  manageUrl: string
  unsubscribeUrl: string
}

function fmt(cents: number) {
  return `$${Math.round(cents / 100)}`
}

function stars(n: number | null) {
  return '★'.repeat(Math.min(5, Math.max(0, Math.round(n ?? 0))))
}

export function DailyDigest({ deals, date, manageUrl, unsubscribeUrl }: DailyDigestProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Your expaify deals for ${date} — ${deals.length} hotel drops`}</Preview>
      <Body style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '540px', margin: '0 auto', padding: '32px 20px' }}>

          {/* Logo */}
          <Text style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: '20px', color: '#0E5A54', margin: '0 0 28px' }}>
            expaify<span style={{ color: '#FF6B4A' }}>.</span>
          </Text>

          <Heading as="h1" style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 700, color: '#141210', margin: '0 0 4px' }}>
            Your deals for {date}
          </Heading>
          <Text style={{ fontSize: '14px', color: '#5C5852', margin: '0 0 24px' }}>
            {deals.length} hotel {deals.length === 1 ? 'price' : 'prices'} dropped today
          </Text>

          {/* Deal list */}
          {deals.map((deal, i) => (
            <Section key={deal.id || i} style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '0.5px solid #E8E2D8', overflow: 'hidden', marginBottom: '12px' }}>
              {deal.photoUrl ? (
                <Img
                  src={deal.photoUrl}
                  alt=""
                  width="540"
                  height="196"
                  style={{ display: 'block', width: '100%', maxWidth: '540px', height: 'auto' }}
                />
              ) : null}
              <Section style={{ padding: '16px 18px' }}>
              <Row>
                <Column>
                  <Text style={{ fontWeight: 700, fontSize: '15px', color: '#141210', margin: '0 0 2px' }}>
                    {deal.hotelName}
                  </Text>
                  <Text style={{ fontSize: '12px', color: '#8A857D', margin: '0 0 8px' }}>
                    {stars(deal.stars)} · {deal.city} · {deal.checkInWindow}
                  </Text>
                </Column>
                <Column style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                  <Text style={{ display: 'inline-block', backgroundColor: '#D9A441', color: '#412402', fontWeight: 700, fontSize: '13px', padding: '3px 9px', borderRadius: '999px', margin: 0 }}>
                    −{deal.discountPct}%
                  </Text>
                </Column>
              </Row>
              <Text style={{ fontSize: '13px', color: '#5C5852', lineHeight: '20px', margin: '0 0 12px' }}>
                <span style={{ fontSize: '22px', fontWeight: 700, color: '#0E5A54' }}>{fmt(deal.dealPriceCents)}</span>
                <span style={{ color: '#8A857D' }}> / night vs median {fmt(deal.medianPriceCents)}</span>
              </Text>
              <Button
                href={deal.dealUrl}
                style={{
                  display: 'block',
                  backgroundColor: '#FF6B4A',
                  color: '#FFFFFF',
                  textDecoration: 'none',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '14px',
                  padding: '11px 20px',
                  borderRadius: '999px',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                See the deal
              </Button>
              <Text style={{ fontSize: '11px', color: '#8A857D', lineHeight: '16px', margin: '10px 0 0' }}>
                Based on {deal.snapshotCount} price checks.
              </Text>
              </Section>
            </Section>
          ))}

          <Button
            href="https://expaify.com/deals"
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
              margin: '20px 0',
            }}
          >
            See all deals
          </Button>

          <Hr style={{ border: 'none', borderTop: '1px solid #E8E2D8', margin: '0 0 16px' }} />

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

export default DailyDigest
