import { useEffect, useState } from 'react'
import { Hourglass, LogOut, RefreshCw, ShieldX } from 'lucide-react'
import { AuthShell } from '../components/Layout'
import { Spinner } from '../components/Ui'
import { useAuth } from '../lib/auth'
import { displayEmail } from '../lib/format'

export function PendingPage() {
  const { profile, session, refresh, signOut } = useAuth()
  const [checking, setChecking] = useState(false)
  const [checkedAt, setCheckedAt] = useState<Date | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh()
    }, 20000)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function checkNow() {
    setChecking(true)
    await refresh()
    setCheckedAt(new Date())
    setChecking(false)
  }

  const blocked = profile?.status === 'rejected' || profile?.status === 'suspended'
  const missingProfile = !profile

  return (
    <AuthShell>
      <div className="card p-7 text-center">
        <span
          className={`mx-auto mb-4 grid size-12 place-items-center rounded-2xl ${
            blocked ? 'bg-[#fff1f0] text-danger' : 'bg-accent-soft text-accent'
          }`}
        >
          {blocked ? <ShieldX className="size-5" /> : <Hourglass className="size-5" />}
        </span>

        <h1 className="text-[21px] font-semibold tracking-[-0.03em]">
          {blocked
            ? 'This account is not active'
            : missingProfile
              ? 'Setting up your membership'
              : 'Your request is with the admins'}
        </h1>

        <p className="mx-auto mt-2 max-w-[320px] text-[13px] leading-relaxed text-muted">
          {blocked
            ? 'An admin has closed access to this account. Send the group a message if you think this is a mistake.'
            : missingProfile
              ? 'We could not read your member profile yet. Give it a moment and check again.'
              : 'STFU is a closed circle. As soon as an admin approves you, the timeline, calendar and memories open up on their own.'}
        </p>

        {profile ? (
          <div className="mt-5 rounded-2xl border border-hair bg-[#fbfbfd] px-4 py-3 text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">Signed in as</p>
            <p className="mt-1 truncate text-[13px] font-medium">{profile.display_name}</p>
            <p className="truncate text-[12px] text-muted">{displayEmail(session?.user.email)}</p>
          </div>
        ) : null}

        {!blocked ? (
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => void checkNow()}
              className="btn btn-primary w-full !py-2.5"
              disabled={checking}
            >
              {checking ? <Spinner /> : <RefreshCw className="size-4" />}
              {checking ? 'Checking…' : 'Check again'}
            </button>
            <p className="text-[11px] text-faint">
              {checkedAt
                ? `Last checked at ${checkedAt.toLocaleTimeString()}`
                : 'This page checks on its own every 20 seconds.'}
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void signOut()}
          className="btn btn-ghost mx-auto mt-3 !text-[12.5px]"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </div>
    </AuthShell>
  )
}
