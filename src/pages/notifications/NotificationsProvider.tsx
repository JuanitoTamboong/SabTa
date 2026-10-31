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
      const { data: latestSeason } = await supabase
        .from('season_results')
        .select('season_number')
        .order('season_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!latestSeason) return

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

  // ✨ NEW CONTENT CHECK (Fallback for page load)
  const checkForNewContent = useCallback(
    async (userId: string, ageCategory: string | null) => {
      if (!ageCategory) return

      const today = new Date().toISOString().split('T')[0]
      if (localStorage.getItem('last_seen_banner_date') === today) return

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: newQuizzes, error: quizErr } = await supabase
        .from('quizzes')
        .select('id, created_at, age_category, status')
        .eq('status', 'published')
        .eq('age_category', ageCategory)
        .gte('created_at', weekAgo)

      if (quizErr) console.error('[NewContent] quiz query failed:', quizErr)

      const { data: newCosmetics, error: cosmeticErr } = await supabase
        .from('cosmetic_items')
        .select('id, created_at, status')
        .eq('status', 'published')
        .gte('created_at', weekAgo)

      if (cosmeticErr) console.error('[NewContent] cosmetic query failed:', cosmeticErr)

      const { data: userInv } = await supabase
        .from('user_inventory')
        .select('cosmetic_item_id')
        .eq('user_id', userId)

      const ownedIds = new Set((userInv ?? []).map((i) => i.cosmetic_item_id))
      const unownedCosmetics = (newCosmetics ?? []).filter((c) => !ownedIds.has(c.id))

      const totalNew = (newQuizzes?.length ?? 0) + unownedCosmetics.length

      if (totalNew > 0) {
        setNewContentCount(totalNew)
        setShowNewContentBanner(true)
        localStorage.setItem('last_seen_banner_date', today) // Mark as seen when shown
      }
    },
    []
  )

  // 🚀 BOOTSTRAP
  useEffect(() => {
    let isMounted = true
    let timer: ReturnType<typeof setTimeout>

    const boot = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
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
        if (isMounted) await checkSeasonAnnouncement()
        if (isMounted) await checkForNewContent(user.id, profileData.age_category)
      } catch (error) {
        console.error('Notifications bootstrap error:', error)
      }
    }

    timer = setTimeout(() => { boot() }, 500)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [refreshIncomingBattles, checkForNewContent])

  // 🔄 FALLBACK POLLING (15s battles, 2m content)
  useEffect(() => {
    if (!profile?.id) return

    const battleInterval = setInterval(() => {
      refreshIncomingBattles(profile.id)
    }, 15000)

    const contentInterval = setInterval(() => {
      checkForNewContent(profile.id, profile.age_category)
    }, 120000)

    return () => {
      clearInterval(battleInterval)
      clearInterval(contentInterval)
    }
  }, [profile?.id, profile?.age_category, refreshIncomingBattles, checkForNewContent])

  // 📡 INSTANT POP-UP VIA SUPABASE REALTIME (The new fix)
  useEffect(() => {
    if (!profile?.id || !profile?.age_category) return

    const channel = supabase
      .channel('new-content-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quizzes' },
        (payload) => {
          const newQuiz = payload.new as any
          // Only show if it matches the player's tier and is published
          if (newQuiz.status === 'published' && newQuiz.age_category === profile.age_category) {
            const today = new Date().toISOString().split('T')[0]
            if (localStorage.getItem('last_seen_banner_date') !== today) {
              setNewContentCount((prev) => prev + 1)
              setShowNewContentBanner(true)
              localStorage.setItem('last_seen_banner_date', today)
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cosmetic_items' },
        (payload) => {
          const newCosmetic = payload.new as any
          if (newCosmetic.status === 'published') {
            const today = new Date().toISOString().split('T')[0]
            if (localStorage.getItem('last_seen_banner_date') !== today) {
              setNewContentCount((prev) => prev + 1)
              setShowNewContentBanner(true)
              localStorage.setItem('last_seen_banner_date', today)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [profile?.id, profile?.age_category])

  const dismissNewContent = () => {
    setShowNewContentBanner(false)
    // localStorage is now handled when the banner is shown, so we don't need it here anymore.
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