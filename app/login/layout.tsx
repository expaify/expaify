import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Log in — expaify',
  description: 'Sign in to expaify to manage your saved hotel deal alerts and account.',
  alternates: { canonical: 'https://expaify.com/login' },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
