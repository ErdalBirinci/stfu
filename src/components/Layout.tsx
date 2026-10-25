import { NavLink, Outlet } from 'react-router-dom'
import { CalendarDays, Home, Images, LogOut, Search, ShieldCheck, UserRound } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { cn } from '../lib/cn'
import { Avatar } from './Avatar'
import { Logo, LogoMark } from './Logo'
import { AuthHero } from './AuthHero'
import { NotificationBell } from './NotificationBell'
import { NotificationsProvider } from '../lib/notifications'
import { CategoriesProvider } from '../lib/categories'
import { PresenceProvider } from '../lib/presence'
import { CategoryNav, MobileOnline, OnlineNow } from './SidebarSections'
import { InstallEntry } from './InstallPrompt'

const navigation = [
  { to: '/', label: 'Timeline', icon: Home, end: true },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, end: false },
  { to: '/memories', label: 'Memories', icon: Images, end: false },
  { to: '/search', label: 'Search', icon: Search, end: false },
]

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition',
    isActive
      ? 'bg-white text-ink shadow-[0_1px_2px_rgba(20,20,43,0.06)]'
      : 'text-muted hover:bg-white/60 hover:text-ink',
  )
}

function Sidebar() {
  const { profile, signOut } = useAuth()

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-hair/80 bg-[#f8f8fb] px-4 py-5 lg:flex">
      <div className="px-2 pb-6">
        <Logo />
      </div>

      <div className="no-scrollbar -mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1 pb-2">
        <nav className="space-y-1">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={navClass}>
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <OnlineNow />

        <CategoryNav />

        {profile?.role === 'admin' ? (
          <>
            <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">
              Administration
            </p>
            <NavLink to="/dobby" className={navClass}>
              <ShieldCheck className="size-4" />
              Dobby
            </NavLink>
          </>
        ) : null}
      </div>

      <div className="mt-auto space-y-1 border-t border-hair/70 pt-3">
        <InstallEntry />
        <NotificationBell withLabel direction="up" align="left" />
        <NavLink to="/profile" className={navClass}>
          <UserRound className="size-4" />
          Me
        </NavLink>
        <div className="flex items-center gap-2.5 rounded-2xl border border-hair bg-white px-3 py-2.5">
          <Avatar name={profile?.display_name ?? 'Me'} path={profile?.avatar_url} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold leading-tight">{profile?.display_name}</p>
            <p className="text-[11px] text-faint">
              {profile?.role === 'admin' ? 'Admin' : 'Member'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="grid size-8 place-items-center rounded-full text-faint transition hover:bg-[#f1f1f5] hover:text-ink"
            aria-label="Sign out"
          >
            <LogOut className="size-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}

function MobileHeader() {
  const { profile } = useAuth()
  return (
    <div className="glass-bar sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-hair/70 px-4 py-2.5 lg:hidden">
      <Logo />
      <MobileOnline />
      <div className="flex items-center gap-1.5">
        <NotificationBell align="right" direction="down" />
        <NavLink to="/profile" aria-label="Your profile">
          <Avatar name={profile?.display_name ?? 'Me'} path={profile?.avatar_url} size={32} />
        </NavLink>
      </div>
    </div>
  )
}

function MobileTabs() {
  const { profile } = useAuth()
  const tabs = profile?.role === 'admin' ? [...navigation, { to: '/dobby', label: 'Dobby', icon: ShieldCheck, end: false }] : navigation
  return (
    <nav className="glass-bar fixed inset-x-0 bottom-0 z-30 flex border-t border-hair/80 pb-[env(safe-area-inset-bottom)] lg:hidden">
      {tabs.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10.5px] font-medium transition',
              isActive ? 'text-accent' : 'text-faint',
            )
          }
        >
          <item.icon className="size-[19px]" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

export function AppLayout() {
  return (
    <CategoriesProvider>
      <PresenceProvider>
        <NotificationsProvider>
          <div className="min-h-dvh bg-canvas">
            <Sidebar />
            <div className="lg:pl-[264px]">
              <MobileHeader />
              <main className="mx-auto w-full max-w-[760px] px-4 pb-24 pt-5 sm:px-6 sm:pt-8 lg:pb-14">
                <Outlet />
              </main>
            </div>
            <MobileTabs />
          </div>
        </NotificationsProvider>
      </PresenceProvider>
    </CategoriesProvider>
  )
}

const canvasBackdrop =
  'radial-gradient(900px 520px at 12% 0%, #e2edff 0%, rgba(226,237,255,0) 62%), radial-gradient(760px 520px at 88% 8%, #f6e9ff 0%, rgba(246,233,255,0) 58%), radial-gradient(900px 620px at 50% 110%, #e9f7f1 0%, rgba(233,247,241,0) 60%), #f7f7fa'

export function AuthShell({
  children,
  variant = 'center',
}: {
  children: React.ReactNode
  variant?: 'center' | 'split'
}) {
  if (variant === 'split') {
    return (
      <div className="min-h-dvh bg-[#f7f7fa] lg:grid lg:grid-cols-[1.04fr_1fr]">
        <AuthHero />

        <section className="relative isolate flex items-center justify-center px-4 pb-10 pt-8 sm:px-6 sm:pb-12 lg:min-h-dvh lg:px-10 lg:py-12">
          <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: canvasBackdrop }} />
          <div className="w-full max-w-[420px]">{children}</div>
        </section>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: canvasBackdrop }} />
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-white/70 bg-white/70 px-3 py-1.5 shadow-[0_10px_30px_-24px_rgba(20,20,43,0.5)] backdrop-blur">
            <LogoMark className="size-6 rounded-lg" />
            <span className="text-[13px] font-semibold tracking-[-0.02em]">STFU</span>
            <span className="text-[11px] text-faint">private circle</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
