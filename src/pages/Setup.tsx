import { AlertTriangle, ArrowUpRight, Database, KeyRound, Terminal } from 'lucide-react'
import { AuthShell } from '../components/Layout'

const steps = [
  {
    icon: Database,
    title: '1 · Create the Supabase project',
    body: 'Sign in at supabase.com and create a free project. The free tier is enough for a small circle.',
  },
  {
    icon: Terminal,
    title: '2 · Run the schema',
    body: 'Open the SQL Editor in your project and run supabase/migrations/0001_init.sql from this repository. It creates every table, policy, trigger and the private media bucket.',
  },
  {
    icon: KeyRound,
    title: '3 · Point the site at it',
    body: 'Copy the Project URL and the anon (publishable) key into .env.local, then restart the dev server. For GitHub Pages, add the same two values as repository secrets.',
  },
]

export function SetupPage() {
  return (
    <AuthShell>
      <div className="card p-6 sm:p-7">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-[#fff6e6] px-2.5 py-1 text-[11px] font-semibold text-[#8f6310]">
          <AlertTriangle className="size-3.5" />
          Setup required
        </span>
        <h1 className="text-[22px] font-semibold tracking-[-0.03em]">Connect a Supabase project</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">
          STFU keeps everything in your own Supabase project: accounts, the timeline, events, albums and the
          private media bucket. Until it has a project to talk to, it stays on this screen.
        </p>

        <ol className="mt-5 space-y-3.5">
          {steps.map((step) => (
            <li key={step.title} className="flex gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[#f3f5f9] text-muted">
                <step.icon className="size-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold">{step.title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 rounded-2xl bg-[#0f1420] p-4 font-mono text-[11.5px] leading-relaxed text-[#c9d6ea]">
          <p className="text-[#7f92ad]"># .env.local</p>
          <p>VITE_SUPABASE_URL=https://your-project.supabase.co</p>
          <p>VITE_SUPABASE_ANON_KEY=your-anon-key</p>
        </div>

        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary mt-4 w-full !py-2.5"
        >
          Open Supabase
          <ArrowUpRight className="size-4" />
        </a>

        <p className="mt-3 text-center text-[11px] leading-relaxed text-faint">
          The anon key is safe to publish — row level security, not the key, keeps the circle closed.
        </p>
      </div>
    </AuthShell>
  )
}
