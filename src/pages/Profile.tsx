import { useEffect, useRef, useState } from 'react'
import { Camera, LogOut, ShieldCheck } from 'lucide-react'
import { updateProfile } from '../lib/api'
import { useAuth } from '../lib/auth'
import { displayEmail, fullDate } from '../lib/format'
import { uploadAvatar } from '../lib/media'
import { Avatar } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { PageHeader, Spinner } from '../components/Ui'

export function ProfilePage() {
  const { profile, session, applyProfile, signOut } = useAuth()
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [avatarPath, setAvatarPath] = useState<string | null>(profile?.avatar_url ?? null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '')
    setBio(profile?.bio ?? '')
    setAvatarPath(profile?.avatar_url ?? null)
  }, [profile?.display_name, profile?.bio, profile?.avatar_url])

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

  async function save() {
    if (displayName.trim().length < 2) {
      toast('Your name needs at least 2 characters.', 'error')
      return
    }
    setSaving(true)
    try {
      const next = await updateProfile({ displayName, bio, avatarPath })
      applyProfile(next)
      setPreview(null)
      toast('Profile saved.', 'success')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not save your profile.', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="Me" title="Your profile" subtitle="How you show up inside the circle." />

      <section className="card overflow-hidden">
        <div className="flex flex-col items-center gap-3 border-b border-hair/70 bg-gradient-to-b from-[#f8fbff] to-white px-5 py-6 sm:flex-row sm:items-center">
          <div className="relative">
            {preview ? (
              <img
                src={preview}
                alt="New profile photo"
                className="size-[76px] rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <Avatar
                name={displayName || 'Me'}
                path={avatarPath ?? undefined}
                size={76}
                ring
              />
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

          <div className="min-w-0 text-center sm:text-left">
            <p className="truncate text-[18px] font-semibold">{displayName || 'Your name'}</p>
            <p className="text-[12.5px] text-muted">{displayEmail(session?.user.email)}</p>
            <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
              <span className="rounded-full bg-[#f2f4f8] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
                {profile?.role === 'admin' ? 'Admin' : 'Member'}
              </span>
              <span className="rounded-full bg-[#eefaf2] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-positive">
                Approved
              </span>
            </div>
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
