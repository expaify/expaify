import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/role'
import { AdminForbidden, AdminRoleCheckError } from '@/app/components/admin/AdminAccessState'
import { AdminUserSearch } from '@/app/components/admin/AdminUserSearch'
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin — Users — expaify',
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage() {
  const admin = await requireAdmin()

  if (!admin.ok) {
    if (admin.reason === 'unauthenticated') {
      redirect('/login?callbackUrl=/admin/users')
    }
    if (admin.reason === 'role_check_failed') {
      return <AdminRoleCheckError />
    }
    return <AdminForbidden />
  }

  return <AdminUserSearch />
}

