import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowRight, MailCheck, ShieldCheck } from 'lucide-react'
import { AuthShell } from '../components/Layout'
import { Spinner } from '../components/Ui'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/cn'
import { normalizeEmail, INTERNAL_EMAIL_DOMAIN } from '../lib/format'

type Mode = 'signin' | 'signup'

export function LoginPage() {
  const { session, profile, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState(false)

  // A signed-in member never needs this screen: the gate sends approved members
  // to the timeline and everybody else to the waiting room.
  if (session) {
    if (!profile) {
      return (
        <AuthShell variant="split">
          <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
            <Spinner className="size-5 text-muted" />
            <p className="text-[13px] text-muted">Signing you in…</p>
          </div>
        </AuthShell>
      )
    }
    return <Navigate to="/" replace />
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setConfirmationSent(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (email.trim().length < 3) {
      setError('Enter your email address or username.')
      return
    }
    const cleanEmail = normalizeEmail(email)
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setError('That does not look like an email address or username.')
      return
    }
    if (password.length < 8) {
      setError('Passwords need at least 8 characters.')
      return
    }
    if (mode === 'signup' && displayName.trim().length < 2) {
      setError('Tell us the name your friends will see.')
      return
    }

    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(cleanEmail, password)
      } else {
        const result = await signUp(cleanEmail, password, displayName.trim())
        setPassword('')
        if (result.needsConfirmation) {
          setConfirmationSent(true)
        }
      }
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Something went wrong.'
      setError(
        message.toLowerCase().includes('invalid login')
          ? 'That email and password combination did not match.'
          : message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell variant="split">
      <div className="card overflow-hidden p-6 sm:p-7">
        <div className="mb-5">
          <h1 className="text-[23px] font-semibold tracking-[-0.03em]">
            {mode === 'signin' ? 'Welcome back' : 'Ask to join the circle'}
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            {mode === 'signin'
              ? 'A quiet place for a small group of friends.'
              : 'Every new member is approved by an admin before the door opens.'}
          </p>
        </div>

        <div className="segmented mb-5 w-full">
          <button
            type="button"
            className="flex-1"
            data-active={mode === 'signin'}
            onClick={() => switchMode('signin')}
          >
            Sign in
          </button>
          <button
            type="button"
            className="flex-1"
            data-active={mode === 'signup'}
            onClick={() => switchMode('signup')}
          >
            Request access
          </button>
        </div>

        {confirmationSent ? (
          <div className="rounded-2xl border border-[#d6e4fb] bg-accent-soft px-4 py-5 text-center">
            <MailCheck className="mx-auto mb-2 size-6 text-accent" />
            <p className="text-[14px] font-semibold">Check your inbox</p>
            <p className="mx-auto mt-1 max-w-[280px] text-[12.5px] leading-relaxed text-[#4a5b74]">
              Confirm your email address to finish creating your account, then come back and sign in. An
              admin still needs to approve you.
            </p>
            <button
              type="button"
              onClick={() => {
                setConfirmationSent(false)
                switchMode('signin')
              }}
              className="btn btn-quiet mt-4 !text-[12.5px]"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'signup' ? (
              <div>
                <label className="label" htmlFor="name">
                  Your name
                </label>
                <input
                  id="name"
                  className="field"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Ada Lovelace"
                  autoComplete="name"
                  maxLength={60}
                />
              </div>
            ) : null}

        <div>
          <label className="label" htmlFor="email">
            Email or username
          </label>
          <input
            id="email"
            type="text"
            className="field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com or dobby_admin"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
          <p className="mt-1 text-[11px] leading-relaxed text-faint">
            A bare username is treated as an internal address on {INTERNAL_EMAIL_DOMAIN}; no mail is ever
            sent there.
          </p>
        </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                className="field"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
            </div>

            {error ? (
              <p className="rounded-xl bg-[#fff5f4] px-3 py-2 text-[12.5px] text-[#9b2c22]">{error}</p>
            ) : null}

            <button type="submit" className="btn btn-primary w-full !py-2.5" disabled={busy}>
              {busy ? <Spinner /> : null}
              {mode === 'signin' ? 'Sign in' : 'Send request'}
              {!busy ? <ArrowRight className="size-4" /> : null}
            </button>
          </form>
        )}

        <div className="mt-5 flex items-start gap-2 border-t border-hair/70 pt-4 text-[11.5px] leading-relaxed text-faint">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            STFU is invite-only. Your email is never shown to anyone outside the approved members of this
            circle.
          </span>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-[11.5px] text-faint">
        <span className={cn('inline-block size-1.5 rounded-full bg-[#b9c3d3]')} />
        Built for a small, closed group
      </div>
    </AuthShell>
  )
}
