import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppLayout } from './components/Layout'
import { LogoMark } from './components/Logo'
import { ToastProvider } from './components/Toast'
import { AuthProvider, useAuth } from './lib/auth'
import { isConfigured } from './lib/supabase'
import { AdminPage } from './pages/Admin'
import { CalendarPage } from './pages/Calendar'
import { EventDetailPage } from './pages/EventDetail'
import { LoginPage } from './pages/Login'
import { MemoriesPage } from './pages/Memories'
import { MemoryDetailPage } from './pages/MemoryDetail'
import { NotFoundPage } from './pages/NotFound'
import { PendingPage } from './pages/Pending'
import { PostDetailPage } from './pages/PostDetail'
import { ProfilePage } from './pages/Profile'
import { ResetPasswordPage } from './pages/Reset'
import { SearchPage } from './pages/Search'
import { SetupPage } from './pages/Setup'
import { TimelinePage } from './pages/Timeline'

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <LogoMark className="size-11 animate-pulse rounded-2xl" />
        <p className="text-[12px] text-faint">Opening the circle…</p>
      </div>
    </div>
  )
}

function CircleGate() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  if (!profile || profile.status !== 'approved') return <PendingPage />
  return <AppLayout />
}

function RecoveryRedirect() {
  const { recovery } = useAuth()
  const location = useLocation()
  if (recovery && location.pathname !== '/reset') return <Navigate to="/reset" replace />
  return null
}

function LoginRoute() {
  const { loading } = useAuth()
  if (loading) return <Splash />
  return <LoginPage />
}

export function App() {
  if (!isConfigured) return <SetupPage />

  return (
    // GitHub Pages has no server-side rewrites, so a real path like /post/x
    // answered with a 404 document. Every route lives behind the hash instead,
    // which the browser resolves inside the one document Pages does serve; the
    // redirect in index.html sends old paths here.
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <RecoveryRedirect />
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/reset" element={<ResetPasswordPage />} />
            <Route element={<CircleGate />}>
              <Route path="/" element={<TimelinePage />} />
              <Route path="/post/:id" element={<PostDetailPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/events/:id" element={<EventDetailPage />} />
              <Route path="/memories" element={<MemoriesPage />} />
              <Route path="/memories/:id" element={<MemoryDetailPage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/dobby" element={<AdminPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  )
}
