import { createHash } from 'node:crypto'

type FreeSubscriber = {
  email: string
  city: string
  source: string
}

export async function syncFreeSubscriber({ email, city, source }: FreeSubscriber): Promise<void> {
  const apiKey = process.env.MAILCHIMP_API_KEY
  const listId = process.env.MAILCHIMP_LIST_ID
  if (!apiKey) throw new Error('MAILCHIMP_API_KEY is not set')
  if (!listId) throw new Error('MAILCHIMP_LIST_ID is not set')

  const normalizedEmail = email.trim().toLowerCase()
  const datacenter = process.env.MAILCHIMP_DC ?? apiKey.split('-').at(-1)
  if (!datacenter) throw new Error('MAILCHIMP_DC is not set and could not be inferred')

  const subscriberHash = createHash('md5').update(normalizedEmail).digest('hex')
  const response = await fetch(
    `https://${datacenter}.api.mailchimp.com/3.0/lists/${listId}/members/${subscriberHash}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${Buffer.from(`anystring:${apiKey}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
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
