import { ImageResponse } from 'next/og'
import { getDealById } from '@/lib/pipeline/dealDetection'

export const runtime = 'nodejs'
export const alt = 'expaify hotel deal'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params
  const deal = await getDealById(dealId).catch(() => null)

  const hotelName = deal?.hotel_name ?? 'Hotel deal'
  const city = deal?.city ?? ''
  const discountPct = deal?.discount_pct ?? 0
  const priceDollars = deal ? `$${Math.floor(deal.deal_price_cents / 100)}/night` : ''
  const window = deal?.check_in_window ?? ''

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: 'linear-gradient(150deg,#0E5A54 0%,#0A4440 100%)',
          padding: '56px 64px',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 32 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>expaify</span>
          <div style={{ width: 7, height: 7, borderRadius: 9999, background: '#FF6B4A' }} />
        </div>

        {/* Discount chip */}
        {discountPct > 0 && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: '#FF6B4A',
              borderRadius: 9999,
              padding: '6px 18px',
              marginBottom: 20,
              alignSelf: 'flex-start',
            }}
          >
            <span style={{ fontSize: 20, fontWeight: 700, color: '#1a0a06' }}>{discountPct}% off</span>
          </div>
        )}

        {/* Hotel name */}
        <div style={{ fontSize: 52, fontWeight: 700, color: '#fff', lineHeight: 1.1, marginBottom: 16 }}>
          {hotelName}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {city && (
            <span style={{ fontSize: 24, color: '#9FE1CB', fontWeight: 500 }}>{city}</span>
          )}
          {window && (
            <span style={{ fontSize: 24, color: '#9FE1CB', fontWeight: 500 }}>· {window}</span>
          )}
          {priceDollars && (
            <span style={{ fontSize: 28, fontWeight: 700, color: '#fff', marginLeft: 'auto' }}>{priceDollars}</span>
          )}
        </div>
      </div>
    ),
    { ...size }
  )
}
