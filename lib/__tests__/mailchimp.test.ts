import { createHash } from 'node:crypto'
import { syncFreeSubscriber } from '@/lib/mailchimp'

describe('syncFreeSubscriber', () => {
  const originalFetch = global.fetch
  const originalEnv = {
    apiKey: process.env.MAILCHIMP_API_KEY,
    datacenter: process.env.MAILCHIMP_DC,
    listId: process.env.MAILCHIMP_LIST_ID,
  }

  beforeEach(() => {
    process.env.MAILCHIMP_API_KEY = 'test-key-us16'
    delete process.env.MAILCHIMP_DC
    process.env.MAILCHIMP_LIST_ID = 'audience-1'
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 })
  })

  afterAll(() => {
    global.fetch = originalFetch
    restoreEnv('MAILCHIMP_API_KEY', originalEnv.apiKey)
    restoreEnv('MAILCHIMP_DC', originalEnv.datacenter)
    restoreEnv('MAILCHIMP_LIST_ID', originalEnv.listId)
  })

  it('upserts the normalized email with free onboarding tags', async () => {
    await syncFreeSubscriber({ email: ' Traveler@Example.com ', city: 'new-york', source: 'onboarding' })

    const hash = createHash('md5').update('traveler@example.com').digest('hex')
    expect(fetch).toHaveBeenCalledWith(
      `https://us16.api.mailchimp.com/3.0/lists/audience-1/members/${hash}`,
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from('anystring:test-key-us16').toString('base64')}`,
        }),
        body: JSON.stringify({
          email_address: 'traveler@example.com',
          status_if_new: 'subscribed',
          tags: ['plan:free', 'city:new-york', 'source:onboarding'],
        }),
      })
    )
  })

  it('rejects a non-successful Mailchimp response', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 })

    await expect(
      syncFreeSubscriber({ email: 'traveler@example.com', city: 'paris', source: 'onboarding' })
    ).rejects.toThrow('Mailchimp subscriber sync failed with status 401')
  })
})

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
