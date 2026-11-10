
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from 'react-router-dom'

import { supabase } from './lib/supabase'

import {
  setupPushNotifications,
  clearPushNotificationUser,
} from './lib/pushNotifications'

import LoadingScreen from './components/LoadingScreen'
import { WarningCircleIcon } from '@phosphor-icons/react'

// Pages
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
import WarLog from './pages/WarLog'

// Notifications
import { NotificationsProvider } from './pages/notifications/NotificationsProvider'
import NotificationsHost from './pages/notifications/NotificationsHost'

// ==========================================
// AUTH CALLBACK
// ==========================================

function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    const authenticate = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (cancelled) return

      if (!session?.user) {
        navigate('/')
        return
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()

      if (cancelled) return

      if (error || !profile) {
        await supabase.auth.signOut()

        if (!cancelled) navigate('/')

        return
      }

      if (profile.role === 'admin') {
        await supabase.auth.signOut()

        if (!cancelled) {
          window.dispatchEvent(
            new CustomEvent('sabta:auth-notice', {
              detail:
                'Admin accounts cannot access the Player app. Please use the Admin portal.',
            })
          )

          navigate('/')
        }

        return
      }

      if (!profile.age_category) {
        navigate('/onboarding')
      } else {
        navigate('/dashboard')
      }
    }

    authenticate().catch((error) => {
      console.error('Authentication callback error:', error)
      if (!cancelled) navigate('/')
    })

    return () => {
      cancelled = true
    }
  }, [navigate])

  return (
    <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">
      AUTHENTICATING...
    </div>
  )
}

// ==========================================
// APP ROUTES
// ==========================================

function AppRoutes({
  session,
  profile,
}: {
  session: any
  profile: any
}) {
  const location = useLocation()

  // Hide GlobalChat on fullscreen pages
  const isFullScreenPage =
    location.pathname.startsWith('/quizzes') ||
    location.pathname.startsWith('/play') ||
    location.pathname.startsWith('/quiz') ||
    location.pathname.startsWith('/clans') ||
    location.pathname.startsWith('/war-log') ||
    location.pathname.startsWith('/war')

  return (
    <>
      <Routes>
        {/* Landing Page */}
        <Route
          path="/"
          element={
            !session ? (
              <LandingPage />
            ) : !profile?.age_category ? (
              <Navigate to="/onboarding" />
            ) : (
              <Navigate to="/dashboard" />
            )
          }
        />

        {/* Authentication */}
        <Route
          path="/auth/callback"
          element={<AuthCallback />}
        />

        {/* Age Selection */}
        <Route
          path="/onboarding"
          element={
            session && profile && !profile.age_category ? (
              <AgeSelection />
            ) : session && profile?.age_category ? (
              <Navigate to="/dashboard" />
            ) : (
              <Navigate to="/" />
            )
          }
        />

        {/* Dashboard */}
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

        {/* Quizzes */}
        <Route
          path="/quizzes"
          element={
            session && profile?.age_category ? (
              <Quizzes />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* Battle History */}
        <Route
          path="/battles"
          element={
            session && profile?.age_category ? (
              <BattleHistory />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* Player Profile */}
        <Route
          path="/profile"
          element={
            session && profile?.age_category ? (
              <Profile />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* Other Player Profile */}
        <Route
          path="/player/:playerId"
          element={
            session && profile?.age_category ? (
              <PlayerProfile />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* Leaderboard */}
        <Route
          path="/leaderboard"
          element={
            session && profile?.age_category ? (
              <Leaderboard />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* Clans */}
        <Route
          path="/clans"
          element={
            session && profile?.age_category ? (
              <Clans />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* War Log */}
        <Route
          path="/war-log"
          element={
            session && profile?.age_category ? (
              <WarLog />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* Rewards */}
        <Route
          path="/rewards"
          element={
            session && profile?.age_category ? (
              <RewardsShop />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* Quiz Gameplay */}
        <Route
          path="/play/:quizId"
          element={
            session && profile?.age_category ? (
              <QuizGameplay />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* Clan War Arena */}
        <Route
          path="/war/:warId"
          element={
            session && profile?.age_category ? (
              <ClanWarArena />
            ) : (
              <Navigate to="/onboarding" />
            )
          }
        />

        {/* Unknown Routes */}
        <Route
          path="*"
          element={<Navigate to="/" />}
        />
      </Routes>

      {/* Global Chat */}
      {session &&
        profile?.age_category &&
        !isFullScreenPage && <GlobalChat />}
    </>
  )
}

// ==========================================
// MAIN APP
// ==========================================

function App() {
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  // Prevent an older profile request from overwriting newer login data
  const profileRequestRef = useRef(0)

  // ==========================================
  // FETCH USER PROFILE
  // ==========================================

  const fetchProfile = useCallback(async (userId: string) => {
    const requestId = ++profileRequestRef.current

    setLoading(true)

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      // Ignore outdated requests
      if (requestId !== profileRequestRef.current) return

      if (error || !data) {
        console.warn('Profile not found:', error)

        setProfile(null)
        setLoading(false)

        await supabase.auth.signOut()

        return
      }

      // Admin accounts cannot access the Player app
      if (data.role === 'admin') {
        setProfile(null)
        setAuthNotice(
          'Admin accounts cannot access the Player app. Please use the Admin portal.'
        )

        setLoading(false)

        await supabase.auth.signOut()

        return
      }

      // Save player profile
      setProfile(data)

    } catch (error) {
      console.error('Profile loading error:', error)

      if (requestId === profileRequestRef.current) {
        setProfile(null)
      }
    } finally {
      if (requestId === profileRequestRef.current) {
        setLoading(false)
      }
    }
  }, [])

  // ==========================================
  // AUTH NOTICE LISTENER
  // ==========================================

  useEffect(() => {
    const handleAuthNotice = (event: Event) => {
      const notice = (event as CustomEvent<string>).detail

      if (notice) {
        setAuthNotice(notice)
      }
    }

    window.addEventListener(
      'sabta:auth-notice',
      handleAuthNotice
    )

    return () => {
      window.removeEventListener(
        'sabta:auth-notice',
        handleAuthNotice
      )
    }
  }, [])

  // ==========================================
  // SUPABASE AUTHENTICATION
  // ==========================================

  useEffect(() => {
    let mounted = true

    // Listen for authentication changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return

        setSession(nextSession)

        if (nextSession?.user) {
          // Run profile fetching outside the auth callback
          Promise.resolve().then(() => {
            if (mounted) {
              void fetchProfile(nextSession.user.id)
            }
          })
        } else {
          profileRequestRef.current++

          setProfile(null)
          setLoading(false)

          clearPushNotificationUser()
        }
      }
    )

    // Get existing session
    const initializeAuth = async () => {
      try {
        const {
          data: { session: currentSession },
          error,
        } = await supabase.auth.getSession()

        if (!mounted) return

        if (error) {
          console.error('Session loading error:', error)
          setLoading(false)
          return
        }

        setSession(currentSession)

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }

      } catch (error) {
        console.error('Authentication initialization error:', error)

        if (mounted) {
          setLoading(false)
        }
      }
    }

    void initializeAuth()

    return () => {
      mounted = false
      profileRequestRef.current++

      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // ==========================================
  // PUSH NOTIFICATION INITIALIZATION
  // ==========================================

  useEffect(() => {
    const userId = session?.user?.id

    // User logged out
    if (!userId) {
      clearPushNotificationUser()
      return
    }

    // Wait until the correct player's profile is loaded
    if (!profile || profile.id !== userId) {
      clearPushNotificationUser()
      return
    }

    // Do not register admin accounts
    if (profile.role === 'admin') {
      clearPushNotificationUser()
      return
    }

    // Initialize Android/iOS push notifications
    console.log('Initializing SabTa push notifications...')

    setupPushNotifications(userId).catch((error) => {
      console.error(
        'SabTa push notification setup failed:',
        error
      )
    })

  }, [session?.user?.id, profile?.id, profile?.role])

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading) {
    return (
      <LoadingScreen
        title="Getting things ready"
        subtitle="Setting up your SabTa arena."
      />
    )
  }

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <BrowserRouter>
      <NotificationsProvider>
        <AppRoutes
          session={session}
          profile={profile}
        />

        {/* Existing in-app notifications */}
        {session && <NotificationsHost />}
      </NotificationsProvider>

      {/* Authentication Warning */}
      {authNotice && (
        <div className="sab-popup-overlay fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="auth-notice-title"
            className="sab-popup-card w-full max-w-sm p-6 text-center"
          >
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200">
              <WarningCircleIcon
                weight="fill"
                className="h-7 w-7"
              />
            </span>

            <h2
              id="auth-notice-title"
              className="mb-2 text-lg font-bold"
            >
              Account not available here
            </h2>

            <p className="mb-6 text-sm text-gray-400">
              {authNotice}
            </p>

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
