import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, ShieldCheck } from 'lucide-react'
import { AuthShell } from '../components/Layout'
import { Spinner } from '../components/Ui'
import { useToast } from '../components/Toast'
import { useAuth } from '../lib/auth'

export function ResetPasswordPage() {
  const { session, loading, updatePassword, endRecovery } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Passwords need at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await updatePassword(password)
      endRecovery()
      toast('Password updated.', 'success')
      navigate('/', { replace: true })
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not update the password.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <AuthShell>
        <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
          <Spinner className="size-5 text-muted" />
          <p className="text-[13px] text-muted">Checking your link…</p>
        </div>
      </AuthShell>
    )
  }

  if (!session) {
    return (
      <AuthShell>
        <div className="card overflow-hidden p-6 text-center sm:p-8">
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-[#fff5f4] text-[#c8332b]">
            <KeyRound className="size-5" />
          </span>
          <h1 className="mt-4 text-[21px] font-semibold tracking-[-0.03em]">This link has expired</h1>
          <p className="mx-auto mt-1.5 max-w-[300px] text-[13px] leading-relaxed text-muted">
            Reset links only work once and only for a short while. Ask for a fresh one from the sign-in
            screen.
          </p>
          <Link to="/login" className="btn btn-primary mt-5">
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="card overflow-hidden p-6 sm:p-8">
        <div className="mb-5">
          <span className="mb-3 inline-grid size-9 place-items-center rounded-xl bg-accent-soft text-accent">
            <KeyRound className="size-4" />
          </span>
          <h1 className="text-[23px] font-semibold tracking-[-0.03em]">Set a new password</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Choose something only you know. You stay signed in on this device.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              className="field"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="label" htmlFor="confirm-password">
              Repeat it
            </label>
            <input
              id="confirm-password"
              type="password"
              className="field"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Same password again"
              autoComplete="new-password"
            />
          </div>

          {error ? (
            <p className="rounded-xl bg-[#fff5f4] px-3 py-2 text-[12.5px] text-[#9b2c22]">{error}</p>
          ) : null}

          <button type="submit" className="btn btn-primary w-full !py-2.5" disabled={busy}>
            {busy ? <Spinner /> : null}
            Save password
            {!busy ? <ArrowRight className="size-4" /> : null}
          </button>
        </form>

        <div className="mt-5 flex items-start gap-2 border-t border-hair/70 pt-4 text-[11.5px] leading-relaxed text-faint">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>Nobody in the circle can see your password, and it is never stored in this browser.</span>
        </div>
      </div>
    </AuthShell>
  )
}
