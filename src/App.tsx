// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'

import LandingPage from './pages/LandingPage'
import AgeSelection from './pages/AgeSelection'
import UserDashboard from './pages/UserDashboard'
import QuizGameplay from './pages/QuizGameplay'
import QuizResults from './pages/QuizResults'
import Profile from './pages/Profile'
import RewardsShop from './pages/RewardsShop'
import Leaderboard from './pages/Leaderboard' // <-- ADDED IMPORT

function AuthCallback() {
  const navigate = useNavigate()
  
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (!profile) {
          await supabase.from('profiles').insert({
            id: session.user.id,
            display_name: session.user.user_metadata.full_name || 'Player',
            role: 'player',
            points: 0
          })
          navigate('/onboarding')
        } else if (!profile.age_category) {
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
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
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
            session && !profile?.age_category ? <AgeSelection /> : 
            session && profile?.age_category ? <Navigate to="/dashboard" /> : 
            <Navigate to="/" />
          } 
        />

        <Route 
          path="/dashboard" 
          element={
            session && profile?.age_category ? <UserDashboard /> : 
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

        {/* ADDED LEADERBOARD ROUTE */}
        <Route 
          path="/leaderboard" 
          element={
            session && profile?.age_category ? <Leaderboard /> : 
            <Navigate to="/onboarding" />
          } 
        />

        {/* ADDED REWARDS SHOP ROUTE */}
        <Route 
          path="/rewards" 
          element={
            session && profile?.age_category ? <RewardsShop /> : 
            <Navigate to="/onboarding" />
          } 
        />

        <Route 
          path="/results" 
          element={
            session && profile?.age_category ? <QuizResults /> : 
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
    </BrowserRouter>
  )
}

export default App