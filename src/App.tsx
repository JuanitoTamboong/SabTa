// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import LoadingScreen from './components/LoadingScreen'
import { WarningCircleIcon } from '@phosphor-icons/react'

import LandingPage from './pages/LandingPage'
import AgeSelection from './pages/AgeSelection'
import UserDashboard from './pages/UserDashboard'
import QuizGameplay from './pages/QuizGameplay'
import Profile from './pages/Profile'
import RewardsShop from './pages/RewardsShop'
import Leaderboard from './pages/Leaderboard'
import GlobalChat from './pages/GlobalChat'
import PlayerProfile from './pages/PlayerProfile'
import Quizzes from './pages/Quizzes'
import BattleHistory from './pages/BattleHistory'
import Clans from './pages/Clans'
import ClanWarArena from './pages/ClanWarArena'  
import WarLog from './pages/WarLog' // 🔥 NEW IMPORT

import { NotificationsProvider } from './pages/notifications/NotificationsProvider'
import NotificationsHost from './pages/notifications/NotificationsHost'

function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle()

        if (error || !profile) {
          await supabase.auth.signOut()
          navigate('/')
          return
        }

        if (profile.role === 'admin') {
          await supabase.auth.signOut()
          window.dispatchEvent(new CustomEvent('sabta:auth-notice', {
            detail: 'Admin accounts cannot access the Player app. Please use the Admin portal.',
          }))
          navigate('/')
          return
        }

        if (!profile.age_category) {
          navigate('/onboarding')
        } else {
          navigate('/dashboard')
        }
      } else {
        navigate('/')
      }
    })
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">
      AUTHENTICATING...
    </div>
  )
}

function AppRoutes({ session, profile }: { session: any, profile: any }) {
  const location = useLocation()
  
  // Hide the global chat bubble on Quiz, Play, Clans, War, and Battle pages
  const isFullScreenPage = 
    location.pathname.startsWith('/quizzes') || 
    location.pathname.startsWith('/play') || 
    location.pathname.startsWith('/quiz') || 
    location.pathname.startsWith('/clans') ||
    location.pathname.startsWith('/war-log') || // 🔥 Hide chat here too
    location.pathname.startsWith('/war')  

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            !session ? <LandingPage /> :
            !profile?.age_category ? <Navigate to="/onboarding" /> :
            <Navigate to="/dashboard" />
          }
        />

        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route
          path="/onboarding"
          element={
            session && profile && !profile?.age_category ? <AgeSelection /> :
            session && profile?.age_category ? <Navigate to="/dashboard" /> :
            <Navigate to="/" />
          }
        />

        <Route
          path="/dashboard"
          element={
            session && profile?.age_category ? (
              <UserDashboard key={location.key} />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        <Route
          path="/quizzes"
          element={
            session && profile?.age_category ? <Quizzes /> :
            <Navigate to="/onboarding" />
          }
        />

        <Route
          path="/battles"
          element={
            session && profile?.age_category ? <BattleHistory /> :
            <Navigate to="/onboarding" />
          }
        />

        <Route
          path="/profile"
          element={
            session && profile?.age_category ? <Profile /> :
            <Navigate to="/onboarding" />
          }
        />

        <Route
          path="/player/:playerId"
          element={
            session && profile?.age_category ? <PlayerProfile /> :
            <Navigate to="/onboarding" />
          }
        />

        <Route
          path="/leaderboard"
          element={
            session && profile?.age_category ? <Leaderboard /> :
            <Navigate to="/onboarding" />
          }
        />

        <Route
          path="/clans"
          element={
            session && profile?.age_category ? <Clans /> :
            <Navigate to="/onboarding" />
          }
        />

        {/* 🔥 NEW: War Log Page */}
        <Route
          path="/war-log"
          element={
            session && profile?.age_category ? <WarLog /> :
            <Navigate to="/onboarding" />
          }
        />

        <Route
          path="/rewards"
          element={
            session && profile?.age_category ? <RewardsShop /> :
            <Navigate to="/onboarding" />
          }
        />

        <Route
          path="/play/:quizId"
          element={
            session && profile?.age_category ? <QuizGameplay /> :
            <Navigate to="/onboarding" />
          }
        />

        {/* 🔥 Clan War Arena with 2-hour timer lobby */}
        <Route
          path="/war/:warId"
          element={
            session && profile?.age_category ? <ClanWarArena /> :
            <Navigate to="/onboarding" />
          }
        />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {session && profile?.age_category && !isFullScreenPage && <GlobalChat />}
    </>
  )
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  useEffect(() => {
    const handleAuthNotice = (event: Event) => {
      const notice = (event as CustomEvent<string>).detail
      if (notice) setAuthNotice(notice)
    }

    window.addEventListener('sabta:auth-notice', handleAuthNotice)
    return () => window.removeEventListener('sabta:auth-notice', handleAuthNotice)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error || !data) {
      console.warn("Profile not found, logging out.")
      await supabase.auth.signOut()
      setProfile(null)
    } else {
      if (data.role === 'admin') {
        await supabase.auth.signOut()
        setProfile(null)
        setAuthNotice('Admin accounts cannot access the Player app. Please use the Admin portal.')
      } else {
        setProfile(data)
      }
    }
    setLoading(false)
  }

  if (loading) {
    return <LoadingScreen title="Getting things ready" subtitle="Setting up your SabTa arena." />
  }

  return (
    <BrowserRouter>
      <NotificationsProvider>
        <AppRoutes session={session} profile={profile} />
        
        {session && <NotificationsHost />}
      </NotificationsProvider>
      {authNotice && (
        <div className="sab-popup-overlay fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="auth-notice-title"
            className="sab-popup-card w-full max-w-sm p-6 text-center"
          >
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
              <WarningCircleIcon weight="fill" className="h-7 w-7" />
            </span>
            <h2 id="auth-notice-title" className="mb-2 text-lg font-bold">Account not available here</h2>
            <p className="mb-6 text-sm text-gray-400">{authNotice}</p>
            <button
              onClick={() => setAuthNotice(null)}
              className="w-full bg-[#d3ff45] px-4 py-3 font-bold text-black hover:brightness-110"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </BrowserRouter>
  )
}

export default App