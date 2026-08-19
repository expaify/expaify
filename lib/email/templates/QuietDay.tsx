import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'

export function QuietDay({ city, dealsUrl, premiumUrl, manageUrl, unsubscribeUrl }: { city: string; dealsUrl: string; premiumUrl: string; manageUrl: string; unsubscribeUrl: string }) {
  return <Html><Head /><Preview>A quick note so a silent inbox doesn&apos;t mean we forgot you.</Preview>
    <Body style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter, sans-serif', margin: 0 }}><Container style={{ maxWidth: '540px', margin: '0 auto', padding: '32px 20px' }}>
      <Text style={{ fontWeight: 700, fontSize: '20px', color: '#0E5A54' }}>expaify<span style={{ color: '#FF6B4A' }}>.</span></Text>
      <Heading as="h1" style={{ fontSize: '22px', color: '#141210' }}>{city} is quiet today.</Heading>
      <Text style={{ color: '#5C5852', lineHeight: '22px' }}>Hey, no <strong>{city}</strong> hotel cleared <strong>30%+ below its 60-day median</strong> in today&apos;s check (we need ≥8 checks on a property before we&apos;ll call it). That&apos;s normal. Peak weeks push &quot;usual&quot; up, so fewer rooms clear the bar. Shoulder dates clear it more often.</Text>
      <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '14px 18px', margin: '20px 0' }}>
        <Text style={{ color: '#141210', margin: '6px 0' }}>• Keep {city} on your free watchlist (you&apos;re set).</Text>
        <Text style={{ color: '#141210', margin: '6px 0' }}>• Browse what&apos;s live across all 20 markets: <a href={dealsUrl}>{dealsUrl}</a></Text>
        <Text style={{ color: '#141210', margin: '6px 0' }}>• Use an unlock when something looks real (3/week on free).</Text>
      </Section>
      <Text style={{ color: '#5C5852', lineHeight: '22px' }}>We&apos;ll email again when {city} actually drops, or with another short note if the market stays quiet.</Text>
      <Button href={premiumUrl} style={{ display: 'block', backgroundColor: '#FF6B4A', color: '#141210', textAlign: 'center', padding: '12px 24px', borderRadius: '999px' }}>Premium adds the other 19 cities + instant mail → {premiumUrl}</Button>
      <Hr style={{ borderColor: '#E8E2D8', marginTop: '24px' }} /><Text style={{ fontSize: '11px', color: '#767168' }}><a href={manageUrl}>Manage preferences</a>{' · '}<a href={unsubscribeUrl}>Unsubscribe</a></Text>
    </Container></Body></Html>
}
