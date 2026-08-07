import { renderToStaticMarkup } from 'react-dom/server'
import { AiDayPlanCard } from '../AiDayPlanCard'

// AI day-plan activities used to be plain, unclickable text. This locks in
// the fix: each activity links to a REAL Google Maps search (never a
// fabricated claim of a specific verified location, since the AI trip
// planner only ever returns a free-text sentence, not a structured place).

describe('AiDayPlanCard map links', () => {
  const activities = [
    { time: '9:00 AM', description: 'Visit Sagrada Familia' },
    { time: '2:00 PM', description: 'Lunch at a local tapas bar' },
  ]

  it('links each activity to a real Google Maps search built from the activity description + destination', () => {
    const html = renderToStaticMarkup(<AiDayPlanCard destination="Barcelona" activities={activities} />)

    expect(html).toContain(
      `href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent('Visit Sagrada Familia Barcelona')}"`,
    )
    expect(html).toContain(
      `href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent('Lunch at a local tapas bar Barcelona')}"`,
    )
  })

  it('opens map links in a new tab with safe rel attributes and an accessible hint', () => {
    const html = renderToStaticMarkup(<AiDayPlanCard destination="Barcelona" activities={activities} />)

    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noopener noreferrer"')
    expect(html).toContain('opens a map search in a new tab')
  })

  it('still shows the real activity description as the link text, not a fabricated place name', () => {
    const html = renderToStaticMarkup(<AiDayPlanCard destination="Barcelona" activities={activities} />)

    expect(html).toContain('Visit Sagrada Familia')
    expect(html).toContain('Lunch at a local tapas bar')
  })

  it('renders nothing when there are no activities', () => {
    const html = renderToStaticMarkup(<AiDayPlanCard destination="Barcelona" activities={[]} />)
    expect(html).toBe('')
  })
})
