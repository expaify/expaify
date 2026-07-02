import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Row, Column,
} from '@react-email/components'

export type DigestDeal = {
  hotelName: string
  city: string
  discountPct: number
  dealPriceCents: number
  dealUrl: string
}

export type DailyDigestProps = {
  deals: DigestDeal[]
  date: string
  unsubscribeUrl: string
}

function fmt(cents: number) {
  return `$${Math.round(cents / 100)}`
}

export function DailyDigest({ deals, date, unsubscribeUrl }: DailyDigestProps) {
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
            <Section key={i} style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '0.5px solid #E8E2D8', padding: '16px 18px', marginBottom: '10px' }}>
              <Row>
                <Column>
                  <Text style={{ fontWeight: 700, fontSize: '15px', color: '#141210', margin: '0 0 2px' }}>
                    {deal.hotelName}
                  </Text>
                  <Text style={{ fontSize: '12px', color: '#8A857D', margin: '0 0 8px' }}>
                    {deal.city} · {fmt(deal.dealPriceCents)}/night
                  </Text>
                </Column>
                <Column style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                  <Text style={{ display: 'inline-block', backgroundColor: '#D9A441', color: '#412402', fontWeight: 700, fontSize: '13px', padding: '3px 9px', borderRadius: '999px', margin: 0 }}>
                    −{deal.discountPct}%
                  </Text>
                </Column>
              </Row>
              <a
                href={deal.dealUrl}
                style={{ fontSize: '13px', color: '#0E5A54', fontWeight: 600, textDecoration: 'none' }}
              >
                Book now →
              </a>
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
            <a href={unsubscribeUrl} style={{ color: '#8A857D' }}>Manage alerts</a>
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
