import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import { TRACKED_MARKETS } from '@/lib/trackedMarkets'

export type TrialNudgeDeal = { hotelName: string; dealPriceCents: number; medianPriceCents: number; discountPct: number; snapshotCount: number }

export function TrialNudgeD7({ city, deal, premiumUrl, prefsUrl, unsubscribeUrl }: { city: string; deal: TrialNudgeDeal | null; premiumUrl: string; prefsUrl: string; unsubscribeUrl: string }) {
  return <Html><Head /><Preview>{`Free keeps 1 city. Premium watches all ${TRACKED_MARKETS.length} and unlocks without the weekly cap.`}</Preview>
    <Body style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter, sans-serif', margin: 0 }}><Container style={{ maxWidth: '540px', margin: '0 auto', padding: '32px 20px' }}>
      <Text style={{ fontWeight: 700, fontSize: '20px', color: '#0E5A54' }}>expaify<span style={{ color: '#FF6B4A' }}>.</span></Text>
      <Heading as="h1" style={{ fontSize: '22px', color: '#141210' }}>One week in on {city}, worth upgrading?</Heading>
      <Text style={{ color: '#5C5852', lineHeight: '22px' }}>You&apos;ve had free alerts on <strong>{city}</strong> for about a week.</Text>
      <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '14px 18px', margin: '12px 0' }}><Text style={{ fontWeight: 700, color: '#141210' }}>Still free forever if you want:</Text><Text style={{ color: '#5C5852' }}>1 city digest · 3 unlocks/week · same 30%+ rule</Text></Section>
      <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '14px 18px', margin: '12px 0' }}><Text style={{ fontWeight: 700, color: '#141210' }}>Premium trial (7 days):</Text><Text style={{ color: '#5C5852' }}>All {TRACKED_MARKETS.length} destinations · Instant + daily alerts · Unlimited unlocks · Filters (discount, stars, price)</Text></Section>
      {deal ? <Text style={{ color: '#141210', lineHeight: '22px' }}>You recently saw real math like: <strong>{deal.hotelName}</strong> · ${(deal.dealPriceCents / 100).toFixed(0)} vs ${(deal.medianPriceCents / 100).toFixed(0)} · −{deal.discountPct}% · {deal.snapshotCount} checks. That&apos;s the standard we use everywhere, not a one-off sale badge.</Text> : <Text style={{ color: '#5C5852', lineHeight: '22px' }}>When {city} is quiet, Premium still surfaces drops in the other markets you might actually book.</Text>}
      <Button href={premiumUrl} style={{ display: 'block', backgroundColor: '#FF6B4A', color: '#141210', textAlign: 'center', padding: '12px 24px', borderRadius: '999px' }}>Start trial: {premiumUrl}</Button>
      <Text style={{ textAlign: 'center' }}><a href={prefsUrl}>Stay free / change city: {prefsUrl}</a></Text>
      <Text style={{ color: '#5C5852', lineHeight: '22px' }}>No pressure either way. We&apos;ll keep watching {city} on free if you stay put.</Text>
      <Hr style={{ borderColor: '#E8E2D8', marginTop: '24px' }} /><Text style={{ fontSize: '11px', color: '#767168' }}><a href={unsubscribeUrl}>Unsubscribe</a></Text>
    </Container></Body></Html>
}
