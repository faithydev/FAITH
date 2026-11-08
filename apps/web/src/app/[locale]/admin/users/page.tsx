import { ActionButton, FormDialog } from '@/components/ui/client';
import { Badge, Button, DataTable, fieldClass, PageHeader, Pagination, SectionTitle, StatusBadge } from '@/components/ui/primitives';
import { api } from '@/lib/api';
import { pageContext } from '@/lib/page';
import type { Paged } from '@/lib/types';

type UserRow = { id: string; email: string; status: string; createdAt: string; profile: { displayName: string } | null; roles: { role: { key: string } }[] };
type Verification = { id: string; kind: string; createdAt: string; user: { email: string; profile: { displayName: string } | null }; org: { name: string } | null };
const STAFF = ['moderator', 'finance', 'support', 'admin'];

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const [{ q, page }, { t, d, status, me }] = await Promise.all([searchParams, pageContext()]);
  const query = new URLSearchParams({ pageSize: '25', ...(q ? { q } : {}), ...(page ? { page } : {}) });
  const canReview = me.permissions.includes('admin.verification.review');
  const [users, verifications] = await Promise.all([
    api<Paged<UserRow>>(`/admin/users?${query}`),
    canReview ? api<Verification[]>('/admin/verifications') : Promise.resolve([]),
  ]);
  const canWrite = me.permissions.includes('admin.users.write');
  const canRoles = me.permissions.includes('admin.roles.write');
  return (
    <>
      <PageHeader title={t('admin.nav.users')} />
      {verifications.length > 0 && (
        <section className="mb-8">
          <SectionTitle title={t('admin.verifications')} />
          <ul className="card divide-y divide-line">
            {verifications.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-sm">
                <span><span className="font-medium">{v.user.profile?.displayName}</span> <Badge>{t(`admin.verificationKinds.${v.kind}`)}</Badge><span className="block text-xs text-muted">{d(v.createdAt)}</span></span>
                <span className="flex gap-2">
                  <ActionButton endpoint={`/admin/verifications/${v.id}/decide`} body={{ approve: false }} label={t('common.reject')} />
                  <ActionButton endpoint={`/admin/verifications/${v.id}/decide`} body={{ approve: true }} label={t('common.approve')} variant="primary" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <form role="search" className="mb-4 flex gap-2">
        <input type="search" name="q" defaultValue={q} aria-label={t('nav.search')} placeholder={t('admin.searchUsers')} className={fieldClass.input} />
        <Button type="submit" variant="secondary">{t('nav.search')}</Button>
      </form>
      <DataTable
        caption={t('admin.nav.users')} rows={users.items} rowKey={(u) => u.id}
        columns={[
          { header: t('app.settings.displayName'), cell: (u) => <span><span className="font-medium">{u.profile?.displayName}</span><span className="block text-xs text-muted">{u.email}</span></span> },
          { header: t('app.settings.roles'), cell: (u) => <span className="flex flex-wrap gap-1">{u.roles.map((r) => <Badge key={r.role.key}>{t(`app.roles.${r.role.key}`)}</Badge>)}</span> },
          { header: t('app.orders.status'), cell: (u) => <StatusBadge status={u.status} label={status(u.status)} /> },
          { header: t('app.orders.date'), cell: (u) => d(u.createdAt) },
          {
            header: '', align: 'end',
            cell: (u) => u.id !== me.id && (
              <span className="flex justify-end gap-1.5">
                {canRoles && (
                  <FormDialog
                    trigger={t('admin.grantRole')} title={t('admin.grantRole')} triggerVariant="secondary" endpoint={`/admin/users/${u.id}/roles/grant`} submitLabel={t('admin.grantRole')} success={t('common.saved')}
                    fields={[{ name: 'role', label: t('app.settings.roles'), type: 'select', required: true, defaultValue: 'moderator', options: STAFF.map((r) => ({ value: r, label: t(`app.roles.${r}`) })) }]}
                  />
                )}
                {canWrite && u.status !== 'DELETED' && (
                  <FormDialog
                    trigger={u.status === 'SUSPENDED' ? t('admin.reinstate') : t('admin.suspend')} title={u.status === 'SUSPENDED' ? t('admin.reinstate') : t('admin.suspend')} description={t('admin.suspendBody')} triggerVariant="secondary"
                    endpoint={`/admin/users/${u.id}/status`} extra={{ status: u.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED', confirm: true }} submitLabel={t('common.confirm')} success={t('common.saved')}
                    fields={[{ name: 'reason', label: t('app.orders.refundReason'), type: 'textarea', required: true, minLength: 3 }]}
                  />
                )}
              </span>
            ),
          },
        ]}
      />
      <Pagination page={users.page} pages={users.pages} hrefFor={(p) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`} labels={{ previous: t('common.previous'), next: t('common.next'), page: t('common.pagination') }} />
    </>
  );
}
