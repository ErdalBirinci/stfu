import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, ImagePlus, KeyRound, LogOut, ShieldCheck } from 'lucide-react'
import { fetchProfileOverview, updateProfile } from '../lib/api'
import { useAuth } from '../lib/auth'
import { displayEmail, fullDate, relativeTime, shortDate } from '../lib/format'
import { signedUrl, uploadAvatar, uploadCover } from '../lib/media'
import { useAsyncData } from '../lib/hooks'
import { Avatar } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { PageHeader, Spinner } from '../components/Ui'

function MiniStat({ label, value, small = false }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-xl border border-hair bg-[#fbfbfd] px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-faint">{label}</p>
      <p className={small ? 'mt-0.5 text-[12.5px] font-semibold' : 'mt-0.5 text-[17px] font-semibold tabular-nums'}>
        {value}
      </p>
    </div>
  )
}

export function ProfilePage() {
  const { profile, session, applyProfile, signOut, updatePassword } = useAuth()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_url ?? null)
  const [coverPath, setCoverPath] = useState<string | null>(profile?.cover_url ?? null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [saving, setSaving] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changing, setChanging] = useState(false)

  const overview = useAsyncData(() => (profile ? fetchProfileOverview(profile.id) : Promise.resolve(null)), [
    profile?.id,
  ])

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '')
    setBio(profile?.bio ?? '')
    setAvatarPath(profile?.avatar_url ?? null)
    setCoverPath(profile?.cover_url ?? null)
  }, [profile?.display_name, profile?.bio, profile?.avatar_url, profile?.cover_url])

  useEffect(() => {
    let alive = true
    if (!coverPath) {
      setCoverUrl(null)
      return
    }
    void signedUrl(coverPath).then((url) => {
      if (alive) setCoverUrl(url)
    })
    return () => {
      alive = false
    }
  }, [coverPath])

  async function handleAvatar(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Choose an image file for your photo.', 'error')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      toast('Profile photos need to be under 8 MB.', 'error')
      return
    }

    setUploading(true)
    setPreview(URL.createObjectURL(file))
    try {
      const userId = session?.user.id
      if (!userId) throw new Error('Please sign in again.')
      const path = await uploadAvatar(userId, file)
      setAvatarPath(path)
      toast('Photo ready — save to keep it.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Upload failed.', 'error')
      setPreview(null)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleCover(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('Choose an image file for your cover.', 'error')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      toast('Cover photos need to be under 12 MB.', 'error')
      return
    }

    setUploadingCover(true)
    try {
      const userId = session?.user.id
      if (!userId) throw new Error('Please sign in again.')
      const path = await uploadCover(userId, file)
      setCoverPath(path)
      toast('Cover ready — save to keep it.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Cover upload failed.', 'error')
    } finally {
      setUploadingCover(false)
      if (coverRef.current) coverRef.current.value = ''
    }
  }

  async function save() {
    if (displayName.trim().length < 2) {
      toast('Your name needs at least 2 characters.', 'error')
      return
    }
    setSaving(true)
    try {
      const next = await updateProfile({ displayName, bio, avatarPath, coverPath })
      applyProfile(next)
      setPreview(null)
      toast('Profile saved.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save your profile.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault()
    if (newPassword.length < 8) {
      toast('Passwords need at least 8 characters.', 'error')
      return
    }
    if (newPassword !== confirmPassword) {
      toast('The two passwords do not match.', 'error')
      return
    }

    setChanging(true)
    try {
      await updatePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      toast('Password updated.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not update your password.', 'error')
    } finally {
      setChanging(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Me" title="Your profile" subtitle="How you show up inside the circle." />

      <section className="card overflow-hidden">
        <div className="relative h-32 bg-[linear-gradient(120deg,#e9f2ff_0%,#f4eeff_45%,#eaf8f1_100%)] sm:h-40">
          {coverUrl ? <img src={coverUrl} alt="" className="size-full object-cover" /> : null}
          <button
            type="button"
            onClick={() => coverRef.current?.click()}
            disabled={uploadingCover}
            className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/85 px-2.5 py-1.5 text-[11.5px] font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-white"
          >
            {uploadingCover ? <Spinner className="size-3" /> : <ImagePlus className="size-3.5" />}
            {coverPath ? 'Change cover' : 'Add cover'}
          </button>
          <input
            ref={coverRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void handleCover(event.target.files)}
          />
        </div>

        <div className="px-5 pb-1">
          <div className="relative z-10 -mt-9 flex flex-wrap items-end gap-3">
            <div className="relative shrink-0">
              {preview ? (
                <img
                  src={preview}
                  alt="New profile photo"
                  className="size-[76px] rounded-full object-cover ring-4 ring-white"
                />
              ) : (
                <div className="ring-4 ring-white rounded-full">
                  <Avatar name={displayName || 'Me'} path={avatarPath ?? undefined} size={76} />
                </div>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border border-hair bg-white text-muted shadow-sm transition hover:text-ink"
                aria-label="Change profile photo"
              >
                {uploading ? <Spinner className="size-3" /> : <Camera className="size-3.5" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void handleAvatar(event.target.files)}
              />
            </div>

            <div className="min-w-0 flex-1 pb-1">
              <p className="truncate text-[18px] font-semibold">{displayName || 'Your name'}</p>
              <p className="text-[12.5px] text-muted">{displayEmail(session?.user.email)}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[#f2f4f8] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
                  {profile?.role === 'admin' ? 'Admin' : 'Member'}
                </span>
                <span className="rounded-full bg-[#eefaf2] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-positive">
                  Approved
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniStat label="Posts" value={overview.data?.postCount ?? 0} />
            <MiniStat label="Memories" value={overview.data?.memoryCount ?? 0} />
            <MiniStat
              label="Joined"
              value={profile ? shortDate(profile.approved_at ?? profile.created_at) : '—'}
              small
            />
          </div>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="label" htmlFor="profile-name">
              Display name
            </label>
            <input
              id="profile-name"
              className="field"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={60}
            />
          </div>
          <div>
            <label className="label" htmlFor="profile-bio">
              About you <span className="font-normal text-faint">optional</span>
            </label>
            <textarea
              id="profile-bio"
              className="field resize-none"
              rows={3}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="A line the others will recognise you by."
              maxLength={280}
            />
            <p className="mt-1 text-right text-[11px] text-faint">{bio.length}/280</p>
          </div>

          <div className="flex justify-end">
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
              {saving ? <Spinner /> : null}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </section>

      {overview.data && (overview.data.posts.length > 0 || overview.data.memories.length > 0) ? (
        <section className="card mt-3.5 p-5">
          <h2 className="text-[15px] font-semibold">Your corner</h2>
          <p className="mt-1 text-[12.5px] text-muted">The last things you added to the circle.</p>

          {overview.data.posts.length > 0 ? (
            <div className="mt-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">Posts</p>
              <div className="mt-2 space-y-1">
                {overview.data.posts.map((post) => (
                  <Link
                    key={post.id}
                    to={`/post/${post.id}`}
                    className="flex items-baseline gap-2 rounded-lg px-2 py-1.5 transition hover:bg-[#f6f6fa]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {post.title || post.body || 'A post with an attachment'}
                    </span>
                    <span className="shrink-0 text-[10.5px] text-faint">{relativeTime(post.created_at)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          {overview.data.memories.length > 0 ? (
            <div className="mt-4">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-faint">Memories</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {overview.data.memories.map((memory) => {
                  const cover = (memory.media ?? []).find((item) => item.kind === 'image')
                  return (
                    <Link
                      key={memory.id}
                      to={`/memories/${memory.id}`}
                      className="group overflow-hidden rounded-xl border border-hair"
                    >
                      <span className="block aspect-[4/3] overflow-hidden bg-[#f1f1f5]">
                        {cover?.url ? (
                          <img
                            src={cover.url}
                            alt=""
                            loading="lazy"
                            className="size-full object-cover transition duration-500 group-hover:scale-[1.03]"
                          />
                        ) : null}
                      </span>
                      <span className="block truncate px-2.5 py-1.5 text-[12px] font-medium">
                        {memory.title}
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="card mt-3.5 p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted" />
          <h2 className="text-[15px] font-semibold">Password</h2>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
          Change it whenever you like — you stay signed in on this device.
        </p>

        <form onSubmit={(event) => void changePassword(event)} className="mt-3.5 space-y-3">
          <div>
            <label className="label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              type="password"
              className="field"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
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
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Same password again"
              autoComplete="new-password"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={changing}>
              {changing ? <Spinner /> : null}
              {changing ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>

      <section className="card mt-3.5 p-5">
        <h2 className="text-[15px] font-semibold">Account</h2>
        <dl className="mt-3 space-y-2.5 text-[12.5px]">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Email</dt>
            <dd className="truncate font-medium">{displayEmail(session?.user.email)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Member since</dt>
            <dd className="font-medium">
              {profile ? fullDate(profile.approved_at ?? profile.created_at) : '—'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted">Access</dt>
            <dd className="inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="size-3.5 text-positive" />
              Approved member
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => void signOut()}
          className="btn btn-quiet mt-4 w-full !text-[12.5px]"
        >
          <LogOut className="size-3.5" />
          Sign out
        </button>
      </section>
    </>
  )
}
