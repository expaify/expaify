import { Body, Button, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from '@react-email/components'

export type FreeWelcomeDeal = { id: string; hotelName: string; city: string; photoUrl: string | null; discountPct: number; dealPriceCents: number; dealUrl: string }

export function FreeWelcome({ city, deal, premiumUrl, manageUrl, unsubscribeUrl }: { city: string; deal: FreeWelcomeDeal | null; premiumUrl: string; manageUrl: string; unsubscribeUrl: string }) {
  return <Html><Head /><Preview>30%+ below the 60-day median, or we don&apos;t bother you.</Preview>
    <Body style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter, sans-serif', margin: 0 }}><Container style={{ maxWidth: '540px', margin: '0 auto', padding: '32px 20px' }}>
      <Text style={{ fontWeight: 700, fontSize: '20px', color: '#0E5A54' }}>expaify<span style={{ color: '#FF6B4A' }}>.</span></Text>
      <Heading as="h1" style={{ fontSize: '22px', color: '#141210' }}>You&apos;re watching {city}.</Heading>
      <Text style={{ color: '#5C5852', lineHeight: '22px' }}>We check Expedia, Booking.com, Kiwi, and Trip.com every day. When a hotel falls 30% or more below its 60-day median, with at least 8 checks, you get the heads-up. You book on the OTA. We never add fees.</Text>
      {deal ? <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', overflow: 'hidden', margin: '20px 0' }}>
        {deal.photoUrl ? <Img src={deal.photoUrl} alt="" width="540" style={{ width: '100%' }} /> : null}
        <Section style={{ padding: '16px 18px' }}><Text style={{ fontWeight: 700, margin: 0 }}>{deal.hotelName}</Text><Text style={{ color: '#767168' }}>{deal.city} · Save {deal.discountPct}% · ${Math.round(deal.dealPriceCents / 100)}/night</Text><Button href={deal.dealUrl} style={{ color: '#0E5A54', fontWeight: 700 }}>See this live deal</Button></Section>
      </Section> : null}
      <Text style={{ color: '#141210', fontWeight: 700 }}>You get 3 unlocks this week to open full booking links.</Text>
      <Button href={premiumUrl} style={{ display: 'block', backgroundColor: '#FF6B4A', color: '#141210', textAlign: 'center', padding: '12px 24px', borderRadius: '999px' }}>Start the 7-day Premium trial</Button>
      <Hr style={{ borderColor: '#E8E2D8', marginTop: '24px' }} /><Text style={{ fontSize: '11px', color: '#767168' }}><a href={manageUrl}>Manage preferences</a>{' · '}<a href={unsubscribeUrl}>Unsubscribe</a></Text>
    </Container></Body></Html>
}
