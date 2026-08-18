import LoginForm from './_form'

type PageProps = {
  searchParams: Promise<{ intent?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { intent } = await searchParams

  return <LoginForm freeIntent={intent === 'free'} />
}
