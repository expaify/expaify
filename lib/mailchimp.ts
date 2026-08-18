import { createHash } from 'node:crypto'

type FreeSubscriber = {
  email: string
  city: string
  source: string
}

type FreeSubscriberCityUpdate = Omit<FreeSubscriber, 'city'> & { city: string | null }

type MailchimpTag = { name: string }
type MailchimpTagChange = { name: string; status: 'active' | 'inactive' }

export async function syncFreeSubscriber({ email, city, source }: FreeSubscriber): Promise<void> {
  const apiKey = process.env.MAILCHIMP_API_KEY
  const listId = process.env.MAILCHIMP_LIST_ID
  if (!apiKey) throw new Error('MAILCHIMP_API_KEY is not set')
  if (!listId) throw new Error('MAILCHIMP_LIST_ID is not set')

  const normalizedEmail = email.trim().toLowerCase()
  const datacenter = process.env.MAILCHIMP_DC ?? apiKey.split('-').at(-1)
  if (!datacenter) throw new Error('MAILCHIMP_DC is not set and could not be inferred')

  const subscriberHash = createHash('md5').update(normalizedEmail).digest('hex')
  const headers = {
    Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
    'Content-Type': 'application/json',
  }
  const response = await fetch(
    `https://${datacenter}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        email_address: normalizedEmail,
        status_if_new: 'subscribed',
        tags: ['plan:free', `city:${city}`, `source:${source}`],
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Mailchimp subscriber sync failed with status ${response.status}`)
  }
}

export async function updateFreeSubscriberCity({ email, city, source }: FreeSubscriberCityUpdate): Promise<void> {
  const apiKey = process.env.MAILCHIMP_API_KEY
  const listId = process.env.MAILCHIMP_LIST_ID
  if (!apiKey) throw new Error('MAILCHIMP_API_KEY is not set')
  if (!listId) throw new Error('MAILCHIMP_LIST_ID is not set')

  const normalizedEmail = email.trim().toLowerCase()
  const datacenter = process.env.MAILCHIMP_DC ?? apiKey.split('-').at(-1)
  if (!datacenter) throw new Error('MAILCHIMP_DC is not set and could not be inferred')
  const subscriberHash = createHash('md5').update(normalizedEmail).digest('hex')
  const memberUrl = `https://${datacenter}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`
  const headers = {
    Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
    'Content-Type': 'application/json',
  }

  const tagsResponse = await fetch(`${memberUrl}/tags`, { headers })
  if (!tagsResponse.ok) {
    throw new Error(`Mailchimp tag lookup failed with status ${tagsResponse.status}`)
  }
  const current = await tagsResponse.json() as { tags?: MailchimpTag[] }
  const newCityTag = city ? `city:${city}` : null
  const tags: MailchimpTagChange[] = (current.tags ?? [])
    .filter(tag => tag.name.startsWith('city:') && tag.name !== newCityTag)
    .map(tag => ({ name: tag.name, status: 'inactive' as const }))
  tags.push(
    { name: 'plan:free', status: 'active' },
    { name: `source:${source}`, status: 'active' },
  )
  if (newCityTag) tags.push({ name: newCityTag, status: 'active' })

  const tagUpdate = await fetch(`${memberUrl}/tags`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ tags }),
  })
  if (!tagUpdate.ok) {
    throw new Error(`Mailchimp tag update failed with status ${tagUpdate.status}`)
  }
}
