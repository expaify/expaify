import { resolveMagicLinkOutcome, MAGIC_LINK_ERROR } from '../magicLinkOutcome'

describe('resolveMagicLinkOutcome', () => {
  it('reports the link as sent only when signIn actually resolved without an error', () => {
    expect(resolveMagicLinkOutcome({ error: undefined }, undefined)).toEqual({ sent: true, error: null })
  })

  // The bug this fixed: the caller previously never inspected signIn's
  // resolved value at all, so it always showed "Check your inbox" -- even
  // when signIn resolved with a real error (rate limited, provider down,
  // bad address rejected server-side, etc.).
  it('does not report the link as sent when signIn resolves with an error', () => {
    expect(resolveMagicLinkOutcome({ error: 'EmailSignInError' }, undefined)).toEqual({
      sent: false,
      error: MAGIC_LINK_ERROR,
    })
  })

  it('does not report the link as sent when signIn throws instead of resolving', () => {
    expect(resolveMagicLinkOutcome(undefined, new Error('network down'))).toEqual({
      sent: false,
      error: MAGIC_LINK_ERROR,
    })
  })
})
