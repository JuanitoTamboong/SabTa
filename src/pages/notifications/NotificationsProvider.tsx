// src/pages/notifications/NotificationsProvider.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { supabase } from '../../lib/supabase'

type AlertData = {
  title: string
  message: string
  type: 'success' | 'error'
} | null

interface NotificationsContextType {
  profile: any
  setProfile: React.Dispatch<React.SetStateAction<any>>
  incomingBattles: any[]
  setIncomingBattles: React.Dispatch<React.SetStateAction<any[]>>
  incomingBetBattles: any[]
  setIncomingBetBattles: React.Dispatch<React.SetStateAction<any[]>>
  refreshIncomingBattles: (userId: string) => Promise<void>
  showStreakModal: boolean
  setShowStreakModal: (v: boolean) => void
  streakReward: { coins: number; newStreak: number }
  showDailyBonusModal: boolean
  setShowDailyBonusModal: (v: boolean) => void
  showNewContentBanner: boolean
  newContentCount: number
  dismissNewContent: () => void
  alertData: AlertData
  setAlertData: (a: AlertData) => void
  checkAndShowDailyChallenge: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<any>(null)
  const [incomingBattles, setIncomingBattles] = useState<any[]>([])
  const [incomingBetBattles, setIncomingBetBattles] = useState<any[]>([])
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [streakReward, setStreakReward] = useState({ coins: 0, newStreak: 0 })
  const [showDailyBonusModal, setShowDailyBonusModal] = useState(false)
  const [showNewContentBanner, setShowNewContentBanner] = useState(false)
  const [newContentCount, setNewContentCount] = useState(0)
  const [alertData, setAlertData] = useState<AlertData>(null)

  const refreshIncomingBattles = useCallback(async (userId: string) => {
    try {
      const { data: pendingBattles } = await supabase
        .from('quiz_battles')
        .select(
          `id, quiz_id, challenger_id, challenger_score, opponent_score, profiles!challenger_id ( display_name, avatar_url )`
        )
        .eq('opponent_id', userId)
        .eq('status', 'pending')
        .is('opponent_score', null)

      setIncomingBattles(pendingBattles || [])

      const { data: pendingBets } = await supabase
        .from('bet_battles')
        .select(
          `id, quiz_id, challenger_id, wager_amount, profiles!challenger_id ( display_name, avatar_url )`
        )
        .eq('opponent_id', userId)
        .eq('status', 'pending')

      setIncomingBetBattles(pendingBets || [])
    } catch (error) {
      console.error('Error refreshing battles:', error)
    }
  }, [])

  const checkAndShowDailyChallenge = async () => {
    try {
      const { data: challengeResult } = await supabase.rpc('check_daily_challenge')
      
      // 🔧 FIX: ONLY show the modal if the RPC just awarded the points right now.
      // If they already claimed it earlier today, challengeResult.claimed is false.
      if (challengeResult?.claimed) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: pData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single()
          if (pData) setProfile(pData)
        }
        
        setTimeout(() => {
          setShowDailyBonusModal(true)
        }, 100)
      }
    } catch (error) {
      console.error('Error checking daily challenge:', error)
    }
  }

  useEffect(() => {
    let isMounted = true
    let timer: ReturnType<typeof setTimeout>

    const boot = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user || !isMounted) return

        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('age_category')
          .eq('id', user.id)
          .maybeSingle()

        if (!profileCheck?.age_category) return

        // 1. CLAIM REWARDS FIRST
        const { data: streakResult } = await supabase.rpc('claim_daily_streak')
        const { data: challengeResult } = await supabase.rpc('check_daily_challenge')

        // 2. FETCH FRESH PROFILE
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (!isMounted || !profileData) return

        setProfile(profileData)

        // 3. TRIGGER MODALS SAFELY
        setTimeout(() => {
          if (!isMounted) return
          
          if (streakResult && streakResult.status === 'success') {
            setStreakReward({
              coins: streakResult.coins,
              newStreak: streakResult.streak,
            })
            setShowStreakModal(true)
          }

          // 🔧 FIX: ONLY show if the RPC just claimed it right now.
          // Removed the profileData.last_challenge_date check so it doesn't
          // pop up again when you refresh the page.
          if (challengeResult?.claimed) {
            setShowDailyBonusModal(true)
          }
        }, 50)

        // 4. INCOMING BATTLES
        await refreshIncomingBattles(user.id)

        // 5. NEW CONTENT BANNER
        if (profileData.age_category && isMounted) {
          const lastSeen = localStorage.getItem('last_seen_banner_date')
          const today = new Date().toISOString().split('T')[0]

          if (lastSeen !== today) {
            const weekAgo = new Date(
              Date.now() - 7 * 24 * 60 * 60 * 1000
            ).toISOString()

            const { data: newQ } = await supabase
              .from('quizzes')
              .select('id')
              .eq('age_category', profileData.age_category)
              .eq('status', 'published')
              .gte('created_at', weekAgo)

            const { data: userInv } = await supabase
              .from('user_inventory')
              .select('cosmetic_item_id')
              .eq('user_id', user.id)
            const ownedIds = userInv?.map((i) => i.cosmetic_item_id) || []

            const { data: newC } = await supabase
              .from('cosmetic_items')
              .select('id')
              .eq('status', 'published')
              .gte('created_at', weekAgo)

            const unownedCosmetics = (newC || []).filter(
              (c) => !ownedIds.includes(c.id)
            )

            const totalNew = (newQ?.length || 0) + unownedCosmetics.length

            if (totalNew > 0 && isMounted) {
              setNewContentCount(totalNew)
              setShowNewContentBanner(true)
            }
          }
        }
      } catch (error) {
        console.error('Notifications bootstrap error:', error)
      }
    }

    timer = setTimeout(() => {
      boot()
    }, 500)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [refreshIncomingBattles])

  // Polling for battles
  useEffect(() => {
    if (!profile?.id) return
    const interval = setInterval(() => {
      refreshIncomingBattles(profile.id)
    }, 15000)
    return () => clearInterval(interval)
  }, [profile?.id, refreshIncomingBattles])

  // Auto-dismiss new content banner
  useEffect(() => {
    if (!showNewContentBanner) return
    const timer = setTimeout(() => {
      dismissNewContent()
    }, 5000)
    return () => clearTimeout(timer)
  }, [showNewContentBanner])

  const dismissNewContent = () => {
    setShowNewContentBanner(false)
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem('last_seen_banner_date', today)
  }

  return (
    <NotificationsContext.Provider
      value={{
        profile,
        setProfile,
        incomingBattles,
        setIncomingBattles,
        incomingBetBattles,
        setIncomingBetBattles,
        refreshIncomingBattles,
        showStreakModal,
        setShowStreakModal,
        streakReward,
        showDailyBonusModal,
        setShowDailyBonusModal,
        showNewContentBanner,
        newContentCount,
        dismissNewContent,
        alertData,
        setAlertData,
        checkAndShowDailyChallenge,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx)
    throw new Error('useNotifications must be inside NotificationsProvider')
  return ctx
}