import {
  Body, Button, Container, Head, Hr, Html,
  Preview, Text,
} from '@react-email/components'

export type TrialEndingEmailProps = {
  email: string
  daysLeft: number
  manageUrl: string
  unsubscribeUrl: string
}

export function TrialEndingEmail({ email, daysLeft, manageUrl, unsubscribeUrl }: TrialEndingEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`Your expaify trial ends in ${daysLeft} days`}</Preview>
      <Body style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '540px', margin: '0 auto', padding: '40px 20px' }}>
          <Text style={{ fontFamily: '"Space Grotesk", Inter, -apple-system, "Segoe UI", sans-serif', fontWeight: 700, fontSize: '20px', color: '#0E5A54', margin: '0 0 32px' }}>
            expaify<span style={{ color: '#FF6B4A' }}>.</span>
          </Text>

          <Text style={{ fontSize: '22px', fontWeight: 700, color: '#141210', margin: '0 0 12px' }}>
            Your trial ends in {daysLeft} days
          </Text>

          <Text style={{ fontSize: '15px', lineHeight: '1.6', color: '#5C5852', margin: '0 0 24px' }}>
            After that, your card on file is charged and instant + daily deal alerts keep coming.
            No action needed to stay on — this is just a heads-up.
          </Text>

          <Button
            href={manageUrl}
            style={{
              display: 'block',
              backgroundColor: '#FF6B4A',
              color: '#141210', /* ink on coral is 6.6:1 (AA); white was 2.8:1 */
              textDecoration: 'none',
              textAlign: 'center',
              fontWeight: 500,
              fontSize: '15px',
              padding: '13px 24px',
              borderRadius: '999px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            Manage my plan
          </Button>

          <Hr style={{ border: 'none', borderTop: '1px solid #E8E2D8', margin: '28px 0 16px' }} />

          <Text style={{ fontSize: '11px', color: '#767168', margin: 0 }}>
            Sent to {email} ·{' '}
            <a href={manageUrl} style={{ color: '#767168' }}>Manage plan</a>
            {' · '}
            <a href={unsubscribeUrl} style={{ color: '#767168' }}>Unsubscribe from deal alerts</a>
            {' · '}
            <a href="https://expaify.com" style={{ color: '#767168' }}>expaify.com</a>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default TrialEndingEmail
