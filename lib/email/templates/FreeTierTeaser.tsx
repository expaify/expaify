import {
  Body, Button, Container, Head, Heading, Hr, Html,
  Img, Preview, Section, Text,
} from '@react-email/components'

export type FreeTierTeaserDeal = {
  discountPct: number
  city: string
  hotelName: string
  photoUrl: string | null
}

export type FreeTierTeaserProps = {
  lockedDealCount: number
  topDeal: FreeTierTeaserDeal | null
  manageUrl: string
  unsubscribeUrl: string
}

// Callers must skip delivery when topDeal is null; the template never invents
// deal content. The nullable prop keeps that send-time contract explicit.
export function FreeTierTeaser({ lockedDealCount, topDeal, manageUrl, unsubscribeUrl }: FreeTierTeaserProps) {
  if (!topDeal) return null

  return (
    <Html>
      <Head />
      <Preview>Don&apos;t miss out on your alerts.</Preview>
      <Body style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '540px', margin: '0 auto', padding: '32px 20px' }}>

          {/* Logo */}
          <Text style={{ fontFamily: '"Space Grotesk", Inter, -apple-system, "Segoe UI", sans-serif', fontWeight: 700, fontSize: '20px', color: '#0E5A54', margin: '0 0 28px' }}>
            expaify<span style={{ color: '#FF6B4A' }}>.</span>
          </Text>

          <Heading as="h1" style={{ fontFamily: '"Space Grotesk", Inter, -apple-system, "Segoe UI", sans-serif', fontSize: '22px', fontWeight: 700, color: '#141210', margin: '0 0 16px' }}>
            Unlock {lockedDealCount} hotel deals now
          </Heading>

          <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', border: '0.5px solid #E8E2D8', overflow: 'hidden', marginBottom: '20px' }}>
            {topDeal.photoUrl ? (
              <Img
                src={topDeal.photoUrl}
                alt=""
                width="540"
                height="196"
                style={{ display: 'block', width: '100%', maxWidth: '540px', height: 'auto' }}
              />
            ) : null}
            <Section style={{ padding: '16px 18px' }}>
              <Text style={{ fontWeight: 700, fontSize: '15px', color: '#141210', margin: '0 0 2px' }}>
                {topDeal.hotelName}
              </Text>
              <Text style={{ fontSize: '12px', color: '#767168', margin: 0 }}>
                {topDeal.city} · Save {topDeal.discountPct}%
              </Text>
            </Section>
          </Section>

          <Text style={{ fontSize: '14px', color: '#5C5852', lineHeight: '22px', margin: '0 0 20px' }}>
            You have {lockedDealCount} hotel deals locked from view. Save {topDeal.discountPct}% on a stay in {topDeal.city}. Upgrade to access these deals immediately.
          </Text>

          <Button
            href="https://expaify.com/join"
            style={{
              display: 'block',
              backgroundColor: '#FF6B4A',
              color: '#141210',
              textDecoration: 'none',
              textAlign: 'center',
              fontWeight: 500,
              fontSize: '14px',
              padding: '12px 24px',
              borderRadius: '999px',
              width: '100%',
              boxSizing: 'border-box',
              margin: '20px 0',
            }}
          >
            Upgrade -- 7-day free trial
          </Button>

          <Hr style={{ border: 'none', borderTop: '1px solid #E8E2D8', margin: '0 0 16px' }} />

          <Text style={{ fontSize: '11px', color: '#767168', margin: 0 }}>
            <a href={manageUrl} style={{ color: '#767168' }}>Manage prefs</a>
            {' · '}
            <a href={unsubscribeUrl} style={{ color: '#767168' }}>Unsubscribe</a>
            {' · '}
            <a href="https://expaify.com" style={{ color: '#767168' }}>expaify.com</a>
            {' · © 2026 expaify'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default FreeTierTeaser
