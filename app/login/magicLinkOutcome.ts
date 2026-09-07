export const MAGIC_LINK_ERROR = 'We couldn’t send that link. Check the address and try again.'

type MinimalSignInResult = { error?: string | null | undefined } | undefined

// signIn('resend', { redirect: false }) resolves even on failure -- it does
// not throw for a rejected/errored sign-in attempt, only for something like
// a genuine network failure. Pulled out as a pure function (and its own
// file, so testing it doesn't need to load the real next-auth/react module)
// because the real bug this fixed was that the caller never read `result`
// at all, and always showed "Check your inbox" regardless of outcome.
export function resolveMagicLinkOutcome(
  result: MinimalSignInResult,
  thrown: unknown
): { sent: boolean; error: string | null } {
  if (thrown !== undefined) return { sent: false, error: MAGIC_LINK_ERROR }
  if (result?.error) return { sent: false, error: MAGIC_LINK_ERROR }
  return { sent: true, error: null }
}
