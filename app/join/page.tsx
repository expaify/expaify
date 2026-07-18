import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import JoinForm from './_form'

export default async function JoinPage() {
  const session = await auth()
  // Already signed in — no need to go through checkout again
  if (session?.user?.id) redirect('/account')

  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
