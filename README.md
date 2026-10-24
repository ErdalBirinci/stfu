# STFU

A small, closed friendship site for one group of people: a shared timeline, an event
calendar, and an archive of photos, clips and voice notes. **Dobby** is the admin of the
circle, and the admin dashboard lives at `/dobby`.

Everything runs on your own **Supabase** free-tier project and the app itself is a
static React build that can live on **GitHub Pages**. There is no server to run.

---

## What it does

| Area | Details |
| --- | --- |
| **Timeline** | Post a titled thread, then everyone replies underneath — FriendFeed style. Replies can be nested one level. Posts, replies and their attachments can be photos, video or audio. |
| **Calendar** | A month view of everything the circle has planned. Any approved member can open an event; everyone else answers **Going / Maybe / Can't go** and sees who else is in. |
| **Memories** | Albums for trips, birthdays and ordinary evenings. Any approved member can add photos, clips or voice notes to an album, and open anything in a fullscreen viewer. |
| **Closed membership** | Sign-up only creates an account request. Until an admin approves it, the database refuses to return a single row of content — the waiting room is part of the data model, not just a screen. |
| **Admin** | `/dobby` holds the request queue, the member list, admin/suspend controls and counts for the whole circle. |
| **Design** | Light, Apple-leaning interface: system font stack, translucent bars, soft cards, quiet gradients. English copy. |

Sign-in accepts a full email address, or a bare username such as `dobby_admin` — those map
to an internal `@stfu.local` address that never receives mail.

## Stack

- React 19 + TypeScript + Vite, React Router 7
- Tailwind CSS v4
- Supabase: Postgres, Auth (email + password), Storage (private bucket, signed URLs)
- GitHub Actions → GitHub Pages

---

## Setup

### 1. Create the Supabase project

Create a project at [supabase.com/dashboard](https://supabase.com/dashboard) on the **free** plan and wait
for it to finish provisioning.

### 2. Install the schema

Open **SQL Editor → New query**, paste the whole of
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and run it once.

That single script creates:

- `profiles` (with `role` and `status`), `posts`, `comments`, `events`, `event_attendees`, `memories`, `media`
- the row level security policies that gate all of them on `status = 'approved'`
- triggers that create a profile for each new auth user and stop members from granting themselves a
  role or an approval
- the private `media` storage bucket (50 MB per file) and its policies
- `admin_members()` for the admin dashboard and `make_admin(email)` for manual bootstrapping

The script is idempotent — running it again is safe.

### 3. Configure auth

In **Authentication → Providers → Email**:

- Keep email + password enabled.
- For a closed group of friends, turning **Confirm email** off makes sign-up immediate. If you leave it
  on, a new member has to click the link in their inbox before they can sign in — both flows are handled
  by the app.
- In **Authentication → URL Configuration**, add your origins:
  - `http://localhost:5173`
  - `https://<your-user>.github.io/<your-repo>/`
  - any custom domain you add later

### 4. Point the app at the project

```bash
cp .env.example .env.local
```

Fill in **Project Settings → API → Project URL** and the **anon / publishable** key:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Both values are public by design: they ship in the browser bundle and row level security is what
keeps strangers out. Never put the `service_role` key in this project.

### 5. Run it

```bash
npm install
npm run dev
```

### 6. Claim admin

The **first account that signs up becomes an admin and is approved automatically**, so a brand new
project is never stuck waiting for an approver.

- Sign up with your own email first.
- Everyone after that appears in **`/dobby` → Requests**.
- If you ever need to promote somebody else, run this in the SQL editor:

  ```sql
  select public.make_admin('friend@example.com');
  ```

---

## Deploy to GitHub Pages

The live site is https://erdalbirinci.github.io/stfu/ and the admin dashboard is
https://erdalbirinci.github.io/stfu/dobby.

1. Create a **public** repository and push this project to `main`.
2. In the repository: **Settings → Secrets and variables → Actions → New repository secret**, add
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the same two values.
3. Push to `main`. The workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
   installs, builds, enables Pages and deploys.
4. The site appears at `https://<user>.github.io/<repo>/`.

Notes:

- The build detects the repository name and sets Vite's `base` automatically, so project-page URLs work
  without edits.
- GitHub Pages has no SPA rewrite. `scripts/postbuild.mjs` copies `index.html` to `404.html`, which is
  what makes deep links such as `/dobby`, `/post/:id` and `/memories/:id` load correctly.
- With a custom domain, `/dobby` keeps working the same way; add the domain under
  **Settings → Pages → Custom domain** and to Supabase's redirect URLs.
- `/dobby` is unlisted, not secret: it is a static file. The real protection is the database policy —
  non-admins cannot read the member queue or change a status even if they know the URL.

---

## How access control works

- `public.is_approved()` and `public.is_admin()` are `security definer` helpers used by every policy.
- Content tables (`posts`, `comments`, `events`, `memories`, `media`, RSVPs) are readable only by
  approved members, and writable only by their author (admins can moderate).
- Pending, rejected and suspended members can read exactly one row: their own profile. Their app shows
  the waiting room; every content query returns nothing.
- Emails are not readable by ordinary members: `profiles` is column-granted without `email`, and only
  the `admin_members()` RPC (which checks `is_admin()`) exposes them.
- Media lives in a **private** bucket. The app resolves short-lived signed URLs, so a leaked link dies
  within the hour.
- A trigger strips `role`, `status` and `approved_at` from any self-update made by a non-admin.

## Free-tier limits worth knowing

- **Storage:** 1 GB total and 50 MB per uploaded file. Long phone videos usually need trimming before
  upload; the picker enforces the 50 MB limit.
- **Database:** 500 MB — plenty for text from a small group.
- **Pausing:** a free project pauses after roughly a week without activity. The site then shows errors
  until you restore it from the dashboard.
- **Email:** Supabase's built-in SMTP is rate limited; for a handful of friends it is fine.

## Project layout

```
src/
  components/    layout, composer, media picker/grid/lightbox, modal, toasts, UI primitives
  lib/           supabase client, typed data access, auth context, formatting, signed URLs
  pages/         timeline, post thread, calendar, event, memories, album, profile, admin, login
supabase/
  migrations/0001_init.sql
.github/workflows/deploy.yml
scripts/postbuild.mjs
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck, build to `dist/`, write the SPA fallback |
| `npm run typecheck` | TypeScript only |
| `npm run preview` | Serve the production build |
