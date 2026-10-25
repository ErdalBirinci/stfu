import { useMemo, useState } from 'react'
import {
  Activity,
  CalendarDays,
  Check,
  CheckCheck,
  HardDrive,
  Images,
  Inbox,
  MessagesSquare,
  Search,
  ShieldCheck,
  ShieldMinus,
  ShieldPlus,
  UserCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import {
  fetchAdminStats,
  fetchAdminStorage,
  fetchAuditLog,
  fetchMembers,
  setMemberRole,
  setMemberStatus,
} from '../lib/api'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/cn'
import { fileSize, relativeTime, shortDate } from '../lib/format'
import { useAsyncData } from '../lib/hooks'
import type { AdminStats, AdminStorage, AuditEntry, Member } from '../lib/types'
import { Avatar } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { EmptyState, ErrorNote, PageHeader, Spinner } from '../components/Ui'
import { NotFoundPage } from './NotFound'

type Tab = 'requests' | 'members' | 'activity'

const STORAGE_LIMIT = 1024 * 1024 * 1024

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'card px-4 py-3.5',
        accent && value > 0 && 'border-[#cfe0fb] bg-gradient-to-br from-[#f4f9ff] to-white',
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
        <span className={cn('grid size-6 place-items-center rounded-lg bg-[#f3f4f8] text-muted', accent && value > 0 && 'bg-accent-soft text-accent')}>
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-1.5 text-[22px] font-semibold leading-none tabular-nums">{value}</p>
    </div>
  )
}

function MemberRow({
  member,
  busy,
  onApprove,
  onReject,
  onRole,
  onStatus,
  isSelf,
}: {
  member: Member
  busy: boolean
  isSelf: boolean
  onApprove?: () => void
  onReject?: () => void
  onRole: () => void
  onStatus: () => void
}) {
  const pending = member.status === 'pending'
  const suspended = member.status === 'suspended' || member.status === 'rejected'

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-hair/70 px-4 py-3 last:border-0">
      <Avatar name={member.display_name} path={member.avatar_url} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[13.5px] font-semibold">{member.display_name}</p>
          {member.role === 'admin' ? (
            <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-accent-deep">
              Admin
            </span>
          ) : null}
          {pending ? (
            <span className="rounded-full bg-[#fff6e6] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-[#9a6a12]">
              Pending
            </span>
          ) : null}
          {suspended ? (
            <span className="rounded-full bg-[#fff1f0] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em] text-danger">
              {member.status}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-[11.5px] text-muted">{member.email}</p>
        <p className="text-[10.5px] text-faint">
          Requested {relativeTime(member.created_at)}
          {member.approved_at ? ` · approved ${shortDate(member.approved_at)}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {isSelf ? (
          <span className="rounded-full bg-[#f2f4f8] px-2 py-1 text-[10.5px] font-semibold text-faint">
            That's you
          </span>
        ) : busy ? (
          <Spinner className="text-muted" />
        ) : pending ? (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="btn btn-primary !px-3 !py-1.5 !text-[12px]"
            >
              <Check className="size-3.5" />
              Approve
            </button>
            <button
              type="button"
              onClick={onReject}
              className="btn btn-quiet !px-3 !py-1.5 !text-[12px]"
            >
              <X className="size-3.5" />
              Decline
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onRole}
              className="btn btn-quiet !px-2.5 !py-1.5 !text-[11.5px]"
              title={member.role === 'admin' ? 'Remove admin rights' : 'Make an admin'}
            >
              {member.role === 'admin' ? (
                <ShieldMinus className="size-3.5" />
              ) : (
                <ShieldPlus className="size-3.5" />
              )}
              {member.role === 'admin' ? 'Demote' : 'Make admin'}
            </button>
            <button
              type="button"
              onClick={onStatus}
              className={cn(
                'btn !px-2.5 !py-1.5 !text-[11.5px]',
                suspended ? 'btn-quiet !text-positive' : 'btn-quiet !text-danger',
              )}
            >
              {suspended ? 'Reactivate' : 'Suspend'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export function AdminPage() {
  const { profile } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('requests')
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const members = useAsyncData(() => fetchMembers(), [])
  const stats = useAsyncData<AdminStats>(() => fetchAdminStats(), [])
  const storage = useAsyncData<AdminStorage>(() => fetchAdminStorage(), [])
  const audit = useAsyncData<AuditEntry[]>(() => fetchAuditLog(), [])

  const pending = useMemo(
    () => (members.data ?? []).filter((member) => member.status === 'pending'),
    [members.data],
  )
  const approved = useMemo(
    () => (members.data ?? []).filter((member) => member.status !== 'pending'),
    [members.data],
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const source = tab === 'requests' ? pending : approved
    if (!needle) return source
    return source.filter(
      (member) =>
        member.display_name.toLowerCase().includes(needle) ||
        (member.email ?? '').toLowerCase().includes(needle),
    )
  }, [approved, pending, query, tab])

  // The route name is unlisted; a non-admin simply sees a missing page.
  if (profile?.role !== 'admin') return <NotFoundPage />

  async function approveAll() {
    if (pending.length === 0) return
    setBusyId('all')
    try {
      for (const member of pending) {
        await setMemberStatus(member.id, 'approved')
      }
      toast(`${pending.length} ${pending.length === 1 ? 'member is' : 'members are'} in.`, 'success')
      members.reload()
      stats.reload()
      audit.reload()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Bulk approval failed.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function act(member: Member, action: () => Promise<void>, message: string) {
    setBusyId(member.id)
    try {
      await action()
      toast(message, 'success')
      members.reload()
      stats.reload()
      audit.reload()
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That action failed.', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const counts = stats.data

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Dobby"
        subtitle="The door, the keys, and everyone inside."
        action={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hair bg-white px-2.5 py-1 text-[11px] font-semibold text-muted">
            <ShieldCheck className="size-3.5 text-accent" />
            Admin only
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          icon={<Inbox className="size-3.5" />}
          label="Awaiting approval"
          value={counts?.pending ?? pending.length}
          accent
        />
        <StatCard icon={<Users className="size-3.5" />} label="Members" value={counts?.members ?? 0} />
        <StatCard icon={<MessagesSquare className="size-3.5" />} label="Posts" value={counts?.posts ?? 0} />
        <StatCard icon={<CalendarDays className="size-3.5" />} label="Events" value={counts?.events ?? 0} />
        <StatCard icon={<Images className="size-3.5" />} label="Memories" value={counts?.memories ?? 0} />
      </div>

      <section className="card mt-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-[13px] font-semibold">
            <HardDrive className="size-4 text-muted" />
            Storage
          </h2>
          <span className="text-[11.5px] text-muted">
            {fileSize(storage.data?.total_bytes ?? 0)} of 1 GB
          </span>
        </div>
        <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#eef0f5]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#4a93ff] to-[#0a6cf5] transition-[width] duration-500"
            style={{ width: `${Math.min(100, ((storage.data?.total_bytes ?? 0) / STORAGE_LIMIT) * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-faint">
          <span>{storage.data?.file_count ?? 0} files</span>
          <span>Photos {fileSize(storage.data?.image_bytes ?? 0)}</span>
          <span>Video {fileSize(storage.data?.video_bytes ?? 0)}</span>
          <span>Audio {fileSize(storage.data?.audio_bytes ?? 0)}</span>
        </div>
      </section>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="segmented">
          <button type="button" data-active={tab === 'requests'} onClick={() => setTab('requests')}>
            Requests {pending.length > 0 ? `(${pending.length})` : ''}
          </button>
          <button type="button" data-active={tab === 'members'} onClick={() => setTab('members')}>
            Members ({approved.length})
          </button>
          <button type="button" data-active={tab === 'activity'} onClick={() => setTab('activity')}>
            Activity
          </button>
        </div>

        <div className="flex items-center gap-2">
          {tab === 'requests' && pending.length > 1 ? (
            <button
              type="button"
              onClick={() => void approveAll()}
              disabled={busyId === 'all'}
              className="btn btn-primary !px-3 !py-1.5 !text-[12px]"
            >
              {busyId === 'all' ? <Spinner /> : <CheckCheck className="size-3.5" />}
              Approve all
            </button>
          ) : null}
          {tab === 'activity' ? null : (
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-faint" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people"
                aria-label="Search members by name or email"
                className="field !w-[190px] !py-1.5 !pl-8 !text-[12.5px]"
              />
            </label>
          )}
        </div>
      </div>

      {tab === 'activity' ? (
        <section className="card mt-3 overflow-hidden">
          {audit.error ? (
            <div className="p-4">
              <ErrorNote message={audit.error} onRetry={audit.reload} />
            </div>
          ) : audit.loading && !audit.data ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2].map((index) => (
                <span key={index} className="skeleton block h-9 w-full rounded-xl" />
              ))}
            </div>
          ) : (audit.data ?? []).length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<Activity className="size-5" />}
                title="Nothing logged yet"
                description="Approvals, suspensions and role changes will be recorded here with who made them."
              />
            </div>
          ) : (
            <ul className="divide-y divide-hair/70">
              {(audit.data ?? []).map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-center gap-2.5 px-4 py-3">
                  <Avatar name={entry.actor?.display_name ?? 'System'} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] leading-snug">
                      <span className="font-semibold">{entry.actor?.display_name ?? 'System'}</span>{' '}
                      {entry.action === 'status' ? 'changed access for' : 'changed the role of'}{' '}
                      <span className="font-semibold">{entry.target?.display_name ?? 'a member'}</span>
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-faint">
                      {entry.detail} · {relativeTime(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
      <section className="card mt-3 overflow-hidden">
        {members.error ? (
          <div className="p-4">
            <ErrorNote message={members.error} onRetry={members.reload} />
          </div>
        ) : members.loading && !members.data ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="flex items-center gap-3">
                <span className="skeleton size-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <span className="skeleton block h-3 w-40 rounded-full" />
                  <span className="skeleton block h-2.5 w-56 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={
                tab === 'requests' ? <UserCheck className="size-5" /> : <UserRound className="size-5" />
              }
              title={tab === 'requests' ? 'No one is waiting' : query ? 'Nobody matches' : 'No members yet'}
              description={
                tab === 'requests'
                  ? 'New sign-ups land here for your approval. Everyone already inside is listed under Members.'
                  : query
                    ? 'Try a different name or email.'
                    : 'Approved members will appear here.'
              }
            />
          </div>
        ) : (
          filtered.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isSelf={member.id === profile?.id}
              busy={busyId === member.id}
              onApprove={() => void act(member, () => setMemberStatus(member.id, 'approved'), `${member.display_name} is in.`)}
              onReject={() => void act(member, () => setMemberStatus(member.id, 'rejected'), 'Request declined.')}
              onRole={() =>
                void act(
                  member,
                  () => setMemberRole(member.id, member.role === 'admin' ? 'member' : 'admin'),
                  member.role === 'admin' ? 'Admin rights removed.' : `${member.display_name} is now an admin.`,
                )
              }
              onStatus={() =>
                void act(
                  member,
                  () => setMemberStatus(member.id, member.status === 'approved' ? 'suspended' : 'approved'),
                  member.status === 'approved' ? 'Access suspended.' : 'Access restored.',
                )
              }
            />
          ))
        )}
      </section>
      )}

      <p className="mt-3 px-1 text-[11px] leading-relaxed text-faint">
        Approvals take effect immediately: an approved member can read and post straight away, a suspended
        member is locked out by the database itself, not just this screen.
      </p>
    </>
  )
}
