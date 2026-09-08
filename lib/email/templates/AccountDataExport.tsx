import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'

export type ExportedWatchlistCity = string

export type ExportedUnlock = { hotelName: string; city: string; unlockedAt: string }

export function AccountDataExport({
  email,
  name,
  createdAt,
  planStatus,
  plan,
  alertPreference,
  alertMinDiscount,
  alertTimezone,
  watchlist,
  unlocks,
}: {
  email: string
  name: string | null
  createdAt: string
  planStatus: string
  plan: string | null
  alertPreference: string
  alertMinDiscount: number
  alertTimezone: string
  watchlist: ExportedWatchlistCity[]
  unlocks: ExportedUnlock[]
}) {
  return <Html><Head /><Preview>Your expaify account data, as requested.</Preview>
    <Body style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter, sans-serif', margin: 0 }}><Container style={{ maxWidth: '560px', margin: '0 auto', padding: '32px 20px' }}>
      <Text style={{ fontWeight: 700, fontSize: '20px', color: '#0E5A54' }}>expaify<span style={{ color: '#FF6B4A' }}>.</span></Text>
      <Heading as="h1" style={{ fontSize: '22px', color: '#141210' }}>Your account data</Heading>
      <Text style={{ color: '#5C5852', lineHeight: '22px' }}>You requested a copy of the data expaify holds on your account. Here is everything we have, as of this email.</Text>

      <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '16px 18px', margin: '20px 0' }}>
        <Text style={{ fontWeight: 700, color: '#141210', margin: '0 0 8px' }}>Account</Text>
        <Text style={{ color: '#141210', margin: '4px 0' }}>Email: {email}</Text>
        <Text style={{ color: '#141210', margin: '4px 0' }}>Name: {name ?? 'Not set'}</Text>
        <Text style={{ color: '#141210', margin: '4px 0' }}>Account created: {createdAt}</Text>
      </Section>

      <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '16px 18px', margin: '20px 0' }}>
        <Text style={{ fontWeight: 700, color: '#141210', margin: '0 0 8px' }}>Subscription &amp; alert preferences</Text>
        <Text style={{ color: '#141210', margin: '4px 0' }}>Plan status: {planStatus}{plan ? ` (${plan})` : ''}</Text>
        <Text style={{ color: '#141210', margin: '4px 0' }}>Alert frequency: {alertPreference}</Text>
        <Text style={{ color: '#141210', margin: '4px 0' }}>Minimum discount alerted on: {alertMinDiscount}%</Text>
        <Text style={{ color: '#141210', margin: '4px 0' }}>Alert timezone: {alertTimezone}</Text>
        <Text style={{ color: '#141210', margin: '4px 0' }}>Watchlist: {watchlist.length > 0 ? watchlist.join(', ') : 'Everywhere (no cities pinned)'}</Text>
      </Section>

      <Section style={{ backgroundColor: '#FFFFFF', borderRadius: '12px', padding: '16px 18px', margin: '20px 0' }}>
        <Text style={{ fontWeight: 700, color: '#141210', margin: '0 0 8px' }}>Deal unlock history</Text>
        {unlocks.length === 0 ? (
          <Text style={{ color: '#5C5852', margin: '4px 0' }}>No deals unlocked yet.</Text>
        ) : unlocks.map((u, i) => (
          <Text key={i} style={{ color: '#141210', margin: '4px 0' }}>{u.hotelName} ({u.city}) — unlocked {u.unlockedAt}</Text>
        ))}
      </Section>

      <Text style={{ color: '#5C5852', lineHeight: '22px' }}>We do not store payment card details ourselves -- billing is handled entirely by Stripe. This export covers every field expaify itself holds about your account.</Text>
      <Hr style={{ borderColor: '#E8E2D8', marginTop: '24px' }} />
      <Text style={{ fontSize: '11px', color: '#767168' }}>Questions about this export? Reply to this email.</Text>
    </Container></Body></Html>
}
