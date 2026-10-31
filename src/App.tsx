// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

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
import Clans from './pages/Clans' // 👈 ADDED THIS

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
          alert("Admin accounts cannot access the Player app. Please use the Admin portal.")
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
  const isQuizRoute = location.pathname.startsWith('/quizzes') || location.pathname.startsWith('/play')

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

        {/* 👇 ADDED CLANS ROUTE HERE 👇 */}
        <Route
          path="/clans"
          element={
            session && profile?.age_category ? <Clans /> :
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

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      {session && profile?.age_category && !isQuizRoute && <GlobalChat />}
    </>
  )
}

function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
        alert("Admin accounts cannot access the Player app. Please use the Admin portal.")
      } else {
        setProfile(data)
      }
    }
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">
        SYSTEM INITIALIZING...
      </div>
    )
  }

  return (
    <BrowserRouter>
      <NotificationsProvider>
        <AppRoutes session={session} profile={profile} />
        
        {session && profile?.age_category && <NotificationsHost />}
      </NotificationsProvider>
    </BrowserRouter>
  )
}

export default App