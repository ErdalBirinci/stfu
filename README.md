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
| **Labels** | The admin files posts under coloured labels from **/dobby → Labels**; members filter the timeline by clicking one in the sidebar. Authors can edit their words but only an admin can label a post. |
| **Presence** | The sidebar lists who currently has the circle open, straight from Supabase Realtime presence — nothing is written to the database. |
| **Installable app** | A web app manifest and service worker make the site installable on phones and desktop; installed it opens full screen and works offline for the shell. |
| **Push** | Installed devices can subscribe to notifications; a database trigger hands every new notification to a Supabase Edge Function that encrypts and delivers it (aes128gcm + VAPID). |
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

Later phases add more files: run `0002`–`0006` the same way, in order. `0006_phase3.sql` is what
creates labels, the presence policies and the push tables.

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

### 7. Turn on push notifications

Push needs one Edge Function and four secrets, all on the free plan.

1. **Create the function.** Edge Functions → *Deploy a new function* → *Via Editor*, name it `push`,
   paste [`supabase/functions/push/index.ts`](supabase/functions/push/index.ts) as `index.ts`, deploy.
   In the function's **Settings**, turn *Verify JWT* **off** — the function authenticates the database
   with its own shared secret instead.
2. **Add secrets** (Edge Functions → Secrets):

   | Secret | Value |
   | --- | --- |
   | `PUSH_WEBHOOK_SECRET` | any long random string |
   | `VAPID_PUBLIC_KEY` | the URL-safe public key below |
   | `VAPID_PRIVATE_JWK` | the matching private JWK JSON |
   | `PUSH_SUBJECT` | `mailto:` address for push-service operators |

   Generate a pair once with:

   ```bash
   node -e "crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']).then(async k=>{const j=await crypto.subtle.exportKey('jwk',k.privateKey);const p=Buffer.concat([Buffer.from([4]),Buffer.from(j.x,'base64url'),Buffer.from(j.y,'base64url')]).toString('base64url');console.log('PUBLIC',p);console.log('JWK',JSON.stringify(j))})"
   ```

   The **public** key also lives in [`src/lib/push.ts`](src/lib/push.ts) — update it there and rebuild
   whenever you rotate the pair. It is public by design; the private half must stay in Supabase.
3. **Point the trigger at the function.** In the SQL editor, once:

   ```sql
   insert into public.push_dispatch_config (id, function_url, shared_secret)
   values (true, 'https://<project-ref>.supabase.co/functions/v1/push', '<PUSH_WEBHOOK_SECRET>')
   on conflict (id) do update
     set function_url = excluded.function_url, shared_secret = excluded.shared_secret;
   ```

   Every `notifications` insert now makes one `net.http_post` call. Without that row the trigger is a
   no-op, so the site works fine before push is configured.

Members then open **Me → App & notifications → Turn on notifications** (on iPhone this only appears
once the app has been added to the home screen; iOS does not deliver push to browser tabs).

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
public/
  manifest.webmanifest  PWA metadata
  sw.js                 service worker: offline shell, push handler
  icons/                generated app icons
supabase/
  migrations/           schema, in order (0001 … 0006)
  functions/push/       Edge Function that delivers notifications
.github/workflows/deploy.yml
scripts/postbuild.mjs   copies index.html to 404.html for deep links
scripts/make-icons.mjs  regenerates public/icons
scripts/push-self-test.mjs  checks the push crypto and service worker logic
```

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Typecheck, build to `dist/`, write the SPA fallback |
| `npm run typecheck` | TypeScript only |
| `npm run preview` | Serve the production build |
| `npm run icons` | Regenerate the PWA icons from the inline SVG |
| `npm run test:push` | Push encryption, VAPID signing and service-worker assertions |
