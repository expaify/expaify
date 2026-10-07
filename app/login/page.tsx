import LoginForm from './_form'

type PageProps = {
  searchParams: Promise<{ intent?: string; city?: string; callbackUrl?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { intent, city, callbackUrl } = await searchParams

  return <LoginForm freeIntent={intent === 'free'} city={city} callbackUrl={callbackUrl} />
}
