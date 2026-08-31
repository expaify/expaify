import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'

export function FreeTrustD3({ city, dealsUrl, premiumUrl, manageUrl, unsubscribeUrl }: { city: string; dealsUrl: string; premiumUrl: string; manageUrl: string; unsubscribeUrl: string }) {
  return <Html><Head /><Preview>We compare each hotel to itself, not to a city average.</Preview>
    <Body style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter, sans-serif', margin: 0 }}><Container style={{ maxWidth: '540px', margin: '0 auto', padding: '32px 20px' }}>
      <Text style={{ fontWeight: 700, fontSize: '20px', color: '#0E5A54' }}>expaify<span style={{ color: '#FF6B4A' }}>.</span></Text>
      <Heading as="h1" style={{ fontSize: '22px', color: '#141210' }}>Why a &quot;cheap&quot; {city} hotel sometimes isn&apos;t a deal</Heading>
      <Text style={{ color: '#5C5852', lineHeight: '22px' }}>Quick plain-English version of how expaify treats <strong>{city}</strong>:</Text>
      <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '14px 18px', margin: '20px 0' }}>
        <Text style={{ color: '#141210' }}>1. Daily snapshots on Expedia, Booking.com, Kiwi, Trip.com</Text>
        <Text style={{ color: '#141210' }}>2. 60-day median per hotel (not a citywide average)</Text>
        <Text style={{ color: '#141210' }}>3. Flag only at 30%+ under that median with ≥8 checks</Text>
        <Text style={{ color: '#141210' }}>4. You book on the OTA, we don&apos;t take a cut</Text>
      </Section>
      <Text style={{ color: '#5C5852', lineHeight: '22px' }}>So a low sticker price can still be &quot;normal&quot; for that property. A higher-end hotel can still be a real drop if it&apos;s far under <em>its</em> usual.</Text>
      <Text style={{ color: '#141210' }}>Your free plan: daily digest for {city} when something qualifies + 3 unlocks/week. See live board: <a href={dealsUrl}>expaify.com/deals</a></Text>
      <Text style={{ color: '#5C5852', lineHeight: '22px' }}>Want every city watched at once? No charge until day 8 if you cancel first.</Text>
      <Button href={premiumUrl} style={{ display: 'block', backgroundColor: '#FF6B4A', color: '#141210', textAlign: 'center', padding: '12px 24px', borderRadius: '999px' }}>Start the 7-day Premium trial</Button>
      <Hr style={{ borderColor: '#E8E2D8', marginTop: '24px' }} /><Text style={{ fontSize: '11px', color: '#767168' }}><a href={manageUrl}>Manage preferences</a>{' · '}<a href={unsubscribeUrl}>Unsubscribe</a></Text>
    </Container></Body></Html>
}
