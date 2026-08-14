'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

type OpinlyClient = {
  anonId?: string
  identify: (identity: { email: string; userId?: string }) => void
  track: (eventName: string, properties: Record<string, unknown>, options?: Record<string, unknown>) => void
}

declare global {
  interface Window {
    opinly?: OpinlyClient
  }
}

export function OpinlyIdentify() {
  const { data: session, status } = useSession()

  useEffect(() => {
    const email = session?.user?.email
    if (status !== 'authenticated' || !email) return

    window.opinly?.identify({
      email,
      userId: session?.user?.id,
    })
  }, [session, status])

  return null
}
