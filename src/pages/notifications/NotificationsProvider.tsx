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

type SeasonTopPlayer = {
  rank: number
  user_id: string
  display_name: string
  avatar_url: string | null
  final_points: number
  reward_coins: number
}

export type SeasonAnnouncement = {
  seasonNumber: number
  topPlayers: SeasonTopPlayer[]
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
  seasonAnnouncement: SeasonAnnouncement
  dismissSeasonAnnouncement: () => Promise<void>
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
  const [seasonAnnouncement, setSeasonAnnouncement] = useState<SeasonAnnouncement>(null)

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
        setTimeout(() => setShowDailyBonusModal(true), 100)
      }
    } catch (error) {
      console.error('Error checking daily challenge:', error)
    }
  }

  const checkSeasonAnnouncement = async () => {
    try {
      // 1. Find the latest season that has results
      const { data: latestSeason } = await supabase
        .from('season_results')
        .select('season_number')
        .order('season_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!latestSeason) return

      // 2. Check if the current user needs to see it
      const { data, error } = await supabase.rpc('get_season_announcement', {
        p_season_number: latestSeason.season_number,
      })

      if (error) {
        console.error('Season announcement RPC error:', error)
        return
      }

      if (data?.should_show && data.top_players?.length) {
        setSeasonAnnouncement({
          seasonNumber: data.season_number,
          topPlayers: data.top_players,
        })
      }
    } catch (err) {
      console.error('Error checking season announcement:', err)
    }
  }

  const dismissSeasonAnnouncement = async () => {
    try {
      if (seasonAnnouncement) {
        await supabase.rpc('mark_season_announcement_seen', {
          p_season_number: seasonAnnouncement.seasonNumber,
        })
      }
    } catch (err) {
      console.error('Error marking season announcement seen:', err)
    } finally {
      setSeasonAnnouncement(null)
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

        const { data: streakResult } = await supabase.rpc('claim_daily_streak')
        const { data: challengeResult } = await supabase.rpc('check_daily_challenge')

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (!isMounted || !profileData) return

        setProfile(profileData)

        setTimeout(() => {
          if (!isMounted) return

          if (streakResult && streakResult.status === 'success') {
            setStreakReward({
              coins: streakResult.coins,
              newStreak: streakResult.streak,
            })
            setShowStreakModal(true)
          }

          if (challengeResult?.claimed) {
            setShowDailyBonusModal(true)
          }
        }, 50)

        await refreshIncomingBattles(user.id)

        if (isMounted) {
          await checkSeasonAnnouncement()
        }

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

  useEffect(() => {
    if (!profile?.id) return
    const interval = setInterval(() => {
      refreshIncomingBattles(profile.id)
    }, 15000)
    return () => clearInterval(interval)
  }, [profile?.id, refreshIncomingBattles])

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
        seasonAnnouncement,
        dismissSeasonAnnouncement,
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