import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/role'
import { getAdminDossier } from '@/lib/admin/dossier'
import { AdminForbidden, AdminRoleCheckError } from '@/app/components/admin/AdminAccessState'
import { AdminAccountDossier } from '@/app/components/admin/AdminAccountDossier'
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin — User detail — expaify',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ userId: string }>
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId } = await params
  const admin = await requireAdmin()

  if (!admin.ok) {
    if (admin.reason === 'unauthenticated') {
      redirect(`/login?callbackUrl=/admin/users/${userId}`)
    }
    if (admin.reason === 'role_check_failed') {
      return <AdminRoleCheckError />
    }
    return <AdminForbidden />
  }

  const dossierResult = await getAdminDossier(userId, admin.data)

  if (!dossierResult.ok) {
    return (
      <div className="mx-auto max-w-[860px] px-5 py-10">
        <a href="/admin/users" className="text-sm font-medium text-[var(--brand)] no-underline">
          ← Back to user lookup
        </a>
        <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--bg-muted)] px-5 py-6 text-center">
          <h1 className="text-h3 text-[var(--text-1)]">Couldn&apos;t load this account</h1>
          <p className="mt-2 text-sm text-[var(--text-2)]">{dossierResult.reason}</p>
        </div>
      </div>
    )
  }

  return <AdminAccountDossier initialDossier={dossierResult.data} userId={userId} adminEmail={admin.data.email} />
}

