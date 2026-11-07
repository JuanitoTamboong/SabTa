// src/pages/notifications/NotificationsProvider.tsx
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react'
import { supabase } from '../../lib/supabase'

type AlertData = {
  title: string
  message: string
  type: 'success' | 'error'
} | null

type FriendRequestNotification = {
  id: string
  follower_id: string
  profiles: {
    display_name: string | null
    avatar_url: string | null
    user_inventory?: {
      is_equipped: boolean
      cosmetic_items: {
        preview_url: string | null
        cosmetic_type: string | null
      } | {
        preview_url: string | null
        cosmetic_type: string | null
      }[] | null
    }[]
  }
}

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
  incomingFriendRequests: FriendRequestNotification[]
  refreshIncomingFriendRequests: (userId: string) => Promise<void>
  dismissFriendRequest: (requestId: string) => void
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
  warReward: any
  setWarReward: (r: any) => void
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<any>(null)
  const [incomingBattles, setIncomingBattles] = useState<any[]>([])
  const [incomingBetBattles, setIncomingBetBattles] = useState<any[]>([])
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<FriendRequestNotification[]>([])
  const dismissedFriendRequestIds = useRef(new Set<string>())
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [streakReward, setStreakReward] = useState({ coins: 0, newStreak: 0 })
  const [showDailyBonusModal, setShowDailyBonusModal] = useState(false)
  const [showNewContentBanner, setShowNewContentBanner] = useState(false)
  const [newContentCount, setNewContentCount] = useState(0)
  const [alertData, setAlertData] = useState<AlertData>(null)
  const [seasonAnnouncement, setSeasonAnnouncement] = useState<SeasonAnnouncement>(null)
  
  // 🔥 NEW: War Reward state
  const [warReward, setWarReward] = useState<any>(null)

  // 🔥 NEW: Fetch recent war rewards (Global) & attach queue
  const checkWarRewards = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_my_war_rewards', { p_since: null })
      if (error) throw error

      const seenMap = JSON.parse(localStorage.getItem('sabta_seen_war_rewards') || '{}')
      
      // Filter out any rewards the user has already seen
      const freshRewards = (data || []).filter((r: any) => !seenMap[r.war_id])
      
      if (freshRewards.length > 0) {
        // Attach the remaining rewards as a queue to the first reward
        const firstReward = { ...freshRewards[0], queue: freshRewards.slice(1) }
        setWarReward(firstReward)
      }
    } catch (error) {
      console.error('Failed to check war rewards:', error)
    }
  }, [])

  const refreshIncomingBattles = useCallback(async (userId: string) => {
    try {
      const { data: pendingBattles } = await supabase
        .from('quiz_battles')
        .select(
          `id, quiz_id, challenger_id, challenger_score, opponent_score, profiles!challenger_id ( display_name, avatar_url ), quizzes ( title, category, questions ( count ) )`
        )
        .eq('opponent_id', userId)
        .eq('status', 'pending')
        .is('opponent_score', null)

      setIncomingBattles(pendingBattles || [])

      const { data: pendingBets } = await supabase
        .from('bet_battles')
        .select(
          `id, quiz_id, challenger_id, wager_amount, profiles!challenger_id ( display_name, avatar_url ), quizzes ( title, category, questions ( count ) )`
        )
        .eq('opponent_id', userId)
        .eq('status', 'pending')

      setIncomingBetBattles(pendingBets || [])
    } catch (error) {
      console.error('Error refreshing battles:', error)
    }
  }, [])

  const refreshIncomingFriendRequests = useCallback(async (userId: string) => {
    const [{ data: followers, error: followersError }, { data: following, error: followingError }] =
      await Promise.all([
        supabase
          .from('follows')
          .select('id, follower_id, profiles!follower_id!inner(id, display_name, avatar_url, role, user_inventory!user_id(is_equipped, cosmetic_items(preview_url, cosmetic_type)))')
          .eq('following_id', userId)
          .eq('profiles.role', 'player'),
        supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', userId),
      ])

    if (followersError || followingError) {
      console.error('Error refreshing friend requests:', followersError || followingError)
      return
    }

    let dismissedIds: string[] = []
    try {
      const savedIds = localStorage.getItem(`sabta-dismissed-friend-requests:${userId}`)
      const parsedIds: unknown = savedIds ? JSON.parse(savedIds) : []
      if (Array.isArray(parsedIds) && parsedIds.every((id) => typeof id === 'string')) {
        dismissedIds = parsedIds
      }
    } catch (error) {
      console.error('Could not load dismissed friend requests:', error)
    }

    const followingIds = new Set((following || []).map((follow) => follow.following_id))
    const dismissedIdsSet = new Set(dismissedIds)
    const requests = (followers || []).flatMap((follow: {
      id: string
      follower_id: string
      profiles: FriendRequestNotification['profiles'] | FriendRequestNotification['profiles'][] | null
    }) => {
      const requester = Array.isArray(follow.profiles) ? follow.profiles[0] : follow.profiles
      if (
        !requester ||
        followingIds.has(follow.follower_id) ||
        dismissedIdsSet.has(follow.id) ||
        dismissedFriendRequestIds.current.has(`${userId}:${follow.id}`)
      ) {
        return []
      }

      return [{
        id: follow.id,
        follower_id: follow.follower_id,
        profiles: {
          display_name: requester.display_name,
          avatar_url: requester.avatar_url,
          user_inventory: requester.user_inventory,
        },
      }]
    })

    setIncomingFriendRequests(requests)
  }, [])

  const dismissFriendRequest = useCallback((requestId: string) => {
    if (profile?.id) {
      const dismissedKey = `${profile.id}:${requestId}`
      dismissedFriendRequestIds.current.add(dismissedKey)

      try {
        const storageKey = `sabta-dismissed-friend-requests:${profile.id}`
        const savedIds: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]')
        const ids = Array.isArray(savedIds) && savedIds.every((id) => typeof id === 'string')
          ? savedIds
          : []
        localStorage.setItem(storageKey, JSON.stringify([...new Set([...ids, requestId])]))
      } catch (error) {
        console.error('Could not save dismissed friend request:', error)
      }
    }

    setIncomingFriendRequests((requests) => requests.filter((request) => request.id !== requestId))
    window.dispatchEvent(new Event('sabta:friend-request-dismissed'))
  }, [profile])

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

  const checkingSeasonAnnouncement = useRef(false)

  const checkSeasonAnnouncement = useCallback(async () => {
    if (checkingSeasonAnnouncement.current) return
    checkingSeasonAnnouncement.current = true

    try {
      const { data: latestSeason, error: seasonError } = await supabase
        .from('season_results')
        .select('season_number')
        .order('season_number', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (seasonError) {
        console.error('Season results query error:', seasonError)
        return
      }

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
    } finally {
      checkingSeasonAnnouncement.current = false
    }
  }, [])

  const dismissSeasonAnnouncement = async () => {
    try {
      if (seasonAnnouncement) {
        const { error } = await supabase.rpc('mark_season_announcement_seen', {
          p_season_number: seasonAnnouncement.seasonNumber,
        })
        if (error) throw error
      }
    } catch (err) {
      console.error('Error marking season announcement seen:', err)
    } finally {
      setSeasonAnnouncement(null)
    }
  }

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
        localStorage.setItem('last_seen_banner_date', today)
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

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (profileError) {
          console.error('Notifications profile query error:', profileError)
          return
        }
        if (!profileData || !isMounted) return

        setProfile(profileData)
        await checkSeasonAnnouncement()

        if (!profileData.age_category && profileData.role !== 'admin') return

        const { data: streakResult } = await supabase.rpc('claim_daily_streak')
        const { data: challengeResult } = await supabase.rpc('check_daily_challenge')

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
        await refreshIncomingFriendRequests(user.id)
        if (isMounted) await checkForNewContent(user.id, profileData.age_category)
        
        // 🔥 NEW: Check for war rewards on boot
        if (isMounted) await checkWarRewards(user.id)
        
      } catch (error) {
        console.error('Notifications bootstrap error:', error)
      }
    }

    timer = setTimeout(() => { boot() }, 500)

    return () => {
      isMounted = false
      clearTimeout(timer)
    }
  }, [
    refreshIncomingBattles,
    refreshIncomingFriendRequests,
    checkForNewContent,
    checkSeasonAnnouncement,
    checkWarRewards,
  ])

  // 🔄 FALLBACK POLLING (15s battles, 2m content, 1m war rewards)
  useEffect(() => {
    if (!profile?.id) return

    const battleInterval = setInterval(() => {
      refreshIncomingBattles(profile.id)
    }, 15000)
    const friendRequestInterval = setInterval(() => {
      refreshIncomingFriendRequests(profile.id)
    }, 15000)

    const contentInterval = setInterval(() => {
      checkForNewContent(profile.id, profile.age_category)
    }, 120000)
    
    const seasonInterval = setInterval(() => {
      void checkSeasonAnnouncement()
    }, 30000)
    
    // 🔥 NEW: Poll for war rewards every 1 minute just in case they finish a war while online
    const warRewardInterval = setInterval(() => {
      void checkWarRewards(profile.id)
    }, 60000)

    return () => {
      clearInterval(battleInterval)
      clearInterval(friendRequestInterval)
      clearInterval(contentInterval)
      clearInterval(seasonInterval)
      clearInterval(warRewardInterval)
    }
  }, [
    profile?.id,
    profile?.age_category,
    refreshIncomingBattles,
    refreshIncomingFriendRequests,
    checkForNewContent,
    checkSeasonAnnouncement,
    checkWarRewards,
  ])

  // 📡 INSTANT POP-UP VIA SUPABASE REALTIME (New Content)
  useEffect(() => {
    if (!profile?.id || !profile?.age_category) return

    const channel = supabase
      .channel('new-content-live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quizzes' },
        (payload) => {
          const newQuiz = payload.new as any
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

  // 📡 INSTANT BATTLE NOTIFICATIONS (Realtime Listener)
  useEffect(() => {
    if (!profile?.id) return

    const battleChannel = supabase
      .channel(`battle-notifications-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bet_battles',
          filter: `opponent_id=eq.${profile.id}`,
        },
        () => {
          refreshIncomingBattles(profile.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'quiz_battles',
          filter: `opponent_id=eq.${profile.id}`,
        },
        () => {
          refreshIncomingBattles(profile.id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(battleChannel)
    }
  }, [profile?.id, refreshIncomingBattles])

  // 📡 INSTANT FRIEND REQUEST NOTIFICATIONS
  useEffect(() => {
    if (!profile?.id) return

    const friendRequestChannel = supabase
      .channel(`friend-requests-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'follows',
          filter: `following_id=eq.${profile.id}`,
        },
        () => {
          void refreshIncomingFriendRequests(profile.id)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'follows',
        },
        () => {
          void refreshIncomingFriendRequests(profile.id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(friendRequestChannel)
    }
  }, [profile?.id, refreshIncomingFriendRequests])

  const dismissNewContent = () => {
    setShowNewContentBanner(false)
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
        incomingFriendRequests,
        refreshIncomingFriendRequests,
        dismissFriendRequest,
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
        warReward,
        setWarReward,
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