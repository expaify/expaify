import { renderToStaticMarkup } from 'react-dom/server'
import { PriceSparkline } from '../PriceSparkline'

describe('PriceSparkline accessibility', () => {
  it('shows visible fallback text (not the chart) when history has fewer than 2 points', () => {
    const html = renderToStaticMarkup(
      <PriceSparkline history={[{ date: '2026-06-01', price_cents: 20000 }]} dealPriceCents={20000} medianPriceCents={20000} />,
    )

    expect(html).toContain('Not enough history to show chart')
    expect(html).not.toContain('<svg')
  })

  it('keeps the chart SVG decorative (aria-hidden) since the real data is exposed as text', () => {
    const html = renderToStaticMarkup(
      <PriceSparkline
        history={[
          { date: '2026-06-01', price_cents: 32000 },
          { date: '2026-06-08', price_cents: 29000 },
          { date: '2026-06-15', price_cents: 26000 },
          { date: '2026-06-22', price_cents: 23000 },
          { date: '2026-06-29', price_cents: 19000 },
        ]}
        dealPriceCents={19000}
        medianPriceCents={26000}
      />,
    )

    expect(html).toContain('aria-hidden')
    expect(html).toContain('<svg')
  })

  it('describes a clearly downward trend with real computed numbers', () => {
    const html = renderToStaticMarkup(
      <PriceSparkline
        history={[
          { date: '2026-06-01', price_cents: 32000 },
          { date: '2026-06-08', price_cents: 29000 },
          { date: '2026-06-15', price_cents: 26000 },
          { date: '2026-06-22', price_cents: 23000 },
          { date: '2026-06-29', price_cents: 19000 },
        ]}
        dealPriceCents={19000}
        medianPriceCents={26000}
      />,
    )

    expect(html).toContain('class="sr-only"')
    expect(html).toContain(
      'Price history from Jun 1 to Jun 29: trended down from $320 to $190, a drop of about 41%. ' +
        'The deal price shown is $190; the usual price is $260.',
    )
  })

  it('describes an upward trend with real computed numbers', () => {
    const html = renderToStaticMarkup(
      <PriceSparkline
        history={[
          { date: '2026-03-01', price_cents: 15000 },
          { date: '2026-03-08', price_cents: 16500 },
          { date: '2026-03-15', price_cents: 18000 },
          { date: '2026-03-22', price_cents: 19500 },
          { date: '2026-03-29', price_cents: 21000 },
        ]}
        dealPriceCents={15000}
        medianPriceCents={18000}
      />,
    )

    expect(html).toContain(
      'Price history from Mar 1 to Mar 29: trended up from $150 to $210, a rise of about 40%. ' +
        'The deal price shown is $150; the usual price is $180.',
    )
  })

  it('describes a flat trend with the averaged value, not a misleading direction', () => {
    const html = renderToStaticMarkup(
      <PriceSparkline
        history={[
          { date: '2026-07-01', price_cents: 20000 },
          { date: '2026-07-08', price_cents: 20200 },
          { date: '2026-07-15', price_cents: 19800 },
          { date: '2026-07-22', price_cents: 20100 },
          { date: '2026-07-29', price_cents: 19900 },
        ]}
        dealPriceCents={19800}
        medianPriceCents={20000}
      />,
    )

    expect(html).toContain(
      'Price history from Jul 1 to Jul 29: held steady around $200 with no significant swings. ' +
        'The deal price shown is $198; the usual price is $200.',
    )
  })

  it('describes a single spike at the specific date it occurred, without hiding the endpoints', () => {
    const html = renderToStaticMarkup(
      <PriceSparkline
        history={[
          { date: '2026-05-01', price_cents: 20000 },
          { date: '2026-05-08', price_cents: 20000 },
          { date: '2026-05-15', price_cents: 35000 },
          { date: '2026-05-22', price_cents: 20000 },
          { date: '2026-05-29', price_cents: 20000 },
        ]}
        dealPriceCents={20000}
        medianPriceCents={20000}
      />,
    )

    expect(html).toContain(
      'Price history from May 1 to May 29: spiked to $350 around May 15 before returning to around $200. ' +
        'The deal price shown is $200; the usual price is $200.',
    )
  })

  it('describes a single dip at the specific date it occurred', () => {
    const html = renderToStaticMarkup(
      <PriceSparkline
        history={[
          { date: '2026-09-01', price_cents: 30000 },
          { date: '2026-09-08', price_cents: 30000 },
          { date: '2026-09-15', price_cents: 12000 },
          { date: '2026-09-22', price_cents: 30000 },
          { date: '2026-09-29', price_cents: 30000 },
        ]}
        dealPriceCents={12000}
        medianPriceCents={30000}
      />,
    )

    expect(html).toContain(
      'Price history from Sep 1 to Sep 29: dipped to $120 around Sep 15 before returning to around $300. ' +
        'The deal price shown is $120; the usual price is $300.',
    )
  })
})
