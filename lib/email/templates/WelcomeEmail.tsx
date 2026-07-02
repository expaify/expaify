import {
  Body, Button, Container, Head, Hr, Html,
  Preview, Text,
} from '@react-email/components'

export type WelcomeEmailProps = {
  email: string
}

export function WelcomeEmail({ email }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You're in — expaify</Preview>
      <Body style={{ backgroundColor: '#FAF7F2', fontFamily: 'Inter, -apple-system, sans-serif', margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: '540px', margin: '0 auto', padding: '40px 20px' }}>
          <Text style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: '20px', color: '#0E5A54', margin: '0 0 32px' }}>
            expaify<span style={{ color: '#FF6B4A' }}>.</span>
          </Text>

          <Text style={{ fontSize: '22px', fontWeight: 700, color: '#141210', margin: '0 0 12px' }}>
            You're in the club.
          </Text>

          <Text style={{ fontSize: '15px', lineHeight: '1.6', color: '#5C5852', margin: '0 0 24px' }}>
            We check hotel prices across 20 destinations every day.
            When a hotel drops 30%+ below its usual price, you'll hear from us.
          </Text>

          <Button
            href="https://expaify.com/deals"
            style={{
              display: 'block',
              backgroundColor: '#FF6B4A',
              color: '#FFFFFF',
              textDecoration: 'none',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '15px',
              padding: '13px 24px',
              borderRadius: '999px',
              width: '100%',
              boxSizing: 'border-box',
            }}
          >
            See today's deals
          </Button>

          <Hr style={{ border: 'none', borderTop: '1px solid #E8E2D8', margin: '28px 0 16px' }} />

          <Text style={{ fontSize: '11px', color: '#8A857D', margin: 0 }}>
            Sent to {email} ·{' '}
            <a href="https://expaify.com/account" style={{ color: '#8A857D' }}>Manage alerts</a>
            {' · '}
            <a href="https://expaify.com" style={{ color: '#8A857D' }}>expaify.com</a>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default WelcomeEmail
