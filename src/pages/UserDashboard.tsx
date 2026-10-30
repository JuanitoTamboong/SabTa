// src/pages/UserDashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  TrophyIcon,
  LightningIcon,
  TargetIcon,
  SignOutIcon,
  HouseIcon,
  GameControllerIcon,
  ShoppingBagIcon,
  UserIcon,
  ClockIcon,
  CaretRightIcon,
  MedalIcon,
  FireIcon,
  CheckCircleIcon,
  CoinsIcon,
  SwordIcon,
} from '@phosphor-icons/react'
import sabtaLogo from '../assets/icons/sabta-logo.png'
import { useNotifications } from './notifications/NotificationsProvider'

export default function UserDashboard() {
  const navigate = useNavigate()
  const { profile, setProfile, checkAndShowDailyChallenge } = useNotifications()
  
  // 🔧 FIX: We start with loading = true
  const [loading, setLoading] = useState(true)
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [equippedBorder, setEquippedBorder] = useState<string | null>(null)
  const [equippedBackground, setEquippedBackground] = useState<string | null>(null)

  const [stats, setStats] = useState({
    totalQuizzes: 0,
    bestScore: 0,
    accuracy: 0,
    level: 1,
    quizzesToday: 0, 
  })

  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [topPlayers, setTopPlayers] = useState<any[]>([])
  const [topPlayersLoading, setTopPlayersLoading] = useState(true)

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  // Fetch Top Players
  useEffect(() => {
    if (!profile?.age_category) {
      setTopPlayersLoading(false)
      return
    }

    const fetchTopPlayers = async () => {
      setTopPlayersLoading(true)
      const { data: topProfiles, error: topError } = await supabase.rpc(
        'get_top_players',
        {
          p_age_category: profile.age_category,
          p_limit: 3,
        }
      )

      if (topError) {
        console.error('TOP PLAYERS ERROR:', topError)
      } else if (topProfiles) {
        setTopPlayers(topProfiles)
      }
      setTopPlayersLoading(false)
    }

    fetchTopPlayers()
  }, [profile?.age_category])

  // Fetch Dashboard Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          navigate('/')
          return
        }

        // 1. Fetch FRESH Profile Data directly from DB
        const { data: freshProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (freshProfile) {
          setProfile(freshProfile) // Update global context instantly
        }

        const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
        setAvatarUrl(freshProfile?.avatar_url || googleAvatar || null)

        // 2. Fetch Cosmetics (Inventory)
        const { data: invData } = await supabase
          .from('user_inventory')
          .select('*, cosmetic_items(*)')
          .eq('user_id', user.id)
          .eq('is_equipped', true)

        if (invData) {
          const border = invData.find((i) => i.cosmetic_items?.cosmetic_type === 'avatar_border')
          if (border?.cosmetic_items?.preview_url) setEquippedBorder(border.cosmetic_items.preview_url)

          const bg = invData.find((i) => i.cosmetic_items?.cosmetic_type === 'background')
          if (bg?.cosmetic_items?.preview_url) setEquippedBackground(bg.cosmetic_items.preview_url)
        }

        // 3. Fetch Attempts
        const { data: attempts } = await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        let quizzesToday = 0
        if (attempts) {
          const today = new Date().toISOString().split('T')[0]
          const totalCompletedToday = attempts.filter(
            (a) => a.status === 'completed' && a.created_at.startsWith(today)
          ).length
          
          quizzesToday = Math.min(totalCompletedToday, 3) 

          if (totalCompletedToday >= 3) {
            await checkAndShowDailyChallenge()
          }
        }

        if (attempts && attempts.length > 0) {
          const recentAttempts = attempts.slice(0, 3)
          const recentAttemptIds = recentAttempts.map(a => a.id)
          const quizIds = recentAttempts.map((a) => a.quiz_id)

          const { data: quizzes } = await supabase
            .from('quizzes')
            .select('id, category')
            .in('id', quizIds)

          const { data: transactions } = await supabase
            .from('point_transactions')
            .select('reference_id, amount')
            .in('reference_id', recentAttemptIds)
            .eq('transaction_type', 'coin_transaction')

          const attemptsWithData = recentAttempts.map((attempt) => {
            const coinTx = transactions?.find(t => t.reference_id === attempt.id)
            const quizData = quizzes?.find((q) => q.id === attempt.quiz_id)
            
            return {
              ...attempt,
              category_name: quizData?.category || 'Unknown Category',
              real_coins_earned: coinTx ? coinTx.amount : 0
            }
          })

          const totalQuizzes = attempts.length
          const bestScore = totalQuizzes > 0 ? Math.max(...attempts.map((a) => a.score)) : 0
          const totalCorrect = attempts.reduce((acc, curr) => acc + curr.correct_answers, 0)
          const totalQuestionsAttempted = attempts.reduce(
            (acc, curr) => acc + (curr.correct_answers + curr.incorrect_answers + curr.unanswered_questions), 0
          )
          const avgAccuracy = totalQuestionsAttempted > 0 ? (totalCorrect / totalQuestionsAttempted) * 100 : 0
          
          const currentPoints = freshProfile?.points ?? 0
          const level = Math.floor(currentPoints / 100) + 1

          setStats({
            totalQuizzes,
            bestScore,
            accuracy: Math.round(avgAccuracy),
            level,
            quizzesToday,
          })
          setRecentActivity(attemptsWithData)
        } else {
          setStats(prev => ({ ...prev, quizzesToday }))
        }

      } catch (error) {
        console.error('Dashboard fetch error:', error)
      } finally {
        // 🔧 FIX: Simply set loading to false, no isMounted checks
        setLoading(false)
      }
    }

    fetchData()
  // 🔧 FIX: Run exactly once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) 

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">
        LOADING DASHBOARD...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex relative">
      {equippedBackground && (
        <div className="fixed inset-0 z-0 pointer-events-none w-full h-full overflow-hidden">
          <img
            src={equippedBackground}
            alt="bg"
            className="w-full h-full object-cover opacity-70 md:opacity-50 scale-105"
          />
          <div className="absolute inset-0 bg-[#050505]/40 md:bg-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-transparent to-[#050505] md:bg-gradient-to-br md:from-[#050505]/90 md:via-[#050505]/50 md:to-transparent" />
        </div>
      )}

      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0f1014]/90 backdrop-blur-xl flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
        <div
          className="flex items-center gap-3 mb-8 px-4 cursor-pointer"
          onClick={() => navigate('/dashboard')}
        >
          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
            <img src={sabtaLogo} alt="SabTa" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tighter">
            SAB<span className="text-[#ccff00]">TA</span>
          </span>
        </div>
        <nav className="flex flex-col w-full gap-2">
          <button className="flex items-center gap-4 w-full p-3 rounded-xl bg-[#ccff00]/10 text-[#ccff00] font-bold transition">
            <HouseIcon weight="fill" className="w-6 h-6" /> Home
          </button>
          <button
            onClick={() => navigate('/quizzes')}
            className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"
          >
            <GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz
          </button>
          <button
            onClick={() => navigate('/leaderboard')}
            className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"
          >
            <TrophyIcon weight="fill" className="w-6 h-6" /> Leaderboard
          </button>
          <button
            onClick={() => navigate('/rewards')}
            className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"
          >
            <ShoppingBagIcon weight="fill" className="w-6 h-6" /> Rewards Shop
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"
          >
            <UserIcon weight="fill" className="w-6 h-6" /> My Profile
          </button>
        </nav>
        <div className="mt-auto w-full">
          <button
            onClick={handleLogout}
            className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition"
          >
            <SignOutIcon weight="fill" className="w-6 h-6" /> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative z-10 w-full overflow-x-hidden">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#ff00a0]/5 rounded-full blur-[100px] pointer-events-none" />

        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 relative z-10 gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-bold mb-1 leading-tight">
              {getGreeting()}, <br className="hidden sm:block" />
              <span className="text-[#ccff00]">
                {profile?.display_name?.split(' ')[0] || 'Player'}
              </span>
              !
            </h1>
            <p className="text-gray-400 text-xs flex flex-wrap items-center gap-1.5 mt-1">
              <FireIcon weight="fill" className="text-[#ff00a0]" />
              <span className="font-bold text-white">
                {profile?.current_streak || 0} Day Streak
              </span>
              <span>•</span> Level {stats.level}
              <span>•</span> {profile?.age_category?.toUpperCase()} Tier
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <div className="bg-black/50 backdrop-blur-md border border-[#ff00a0]/30 px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <CoinsIcon weight="fill" className="text-[#ff00a0] w-4 h-4" />
                <span className="font-bold text-xs text-[#ff00a0]">
                  {profile?.coins || 0}
                </span>
              </div>
              <div className="bg-black/50 backdrop-blur-md border border-white/10 px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <LightningIcon weight="fill" className="text-[#ccff00] w-4 h-4" />
                <span className="font-bold text-xs">
                  {profile?.points || 0} PTS
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
                <div className="absolute inset-[15%] rounded-full bg-gradient-to-br from-[#00f0ff] to-blue-600 flex items-center justify-center font-bold text-black uppercase overflow-hidden z-10">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    profile?.display_name?.charAt(0) || 'P'
                  )}
                </div>
                {equippedBorder && (
                  <img
                    src={equippedBorder}
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
                  />
                )}
              </div>
              <button
                onClick={handleLogout}
                className="md:hidden bg-red-500/10 text-red-400 p-2 rounded-xl border border-red-500/20"
              >
                <SignOutIcon weight="bold" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* STATS GRID */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-6 relative z-10">
          <div className="bg-black/50 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <GameControllerIcon
                weight="duotone"
                className="text-[#00f0ff] w-4 h-4 sm:w-5 sm:h-5"
              />
              <p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                Played
              </p>
            </div>
            <p className="text-xl sm:text-2xl font-bold">{stats.totalQuizzes}</p>
          </div>
          <div className="bg-black/50 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <TrophyIcon
                weight="duotone"
                className="text-[#ff00a0] w-4 h-4 sm:w-5 sm:h-5"
              />
              <p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                Best Score
              </p>
            </div>
            <p className="text-xl sm:text-2xl font-bold">
              {stats.bestScore}{' '}
              <span className="text-[10px] sm:text-xs text-gray-500">pts</span>
            </p>
          </div>
          <div className="bg-black/50 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
              <TargetIcon
                weight="duotone"
                className="text-[#ccff00] w-4 h-4 sm:w-5 sm:h-5"
              />
              <p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase tracking-wider">
                Accuracy
              </p>
            </div>
            <p className="text-xl sm:text-2xl font-bold">{stats.accuracy}%</p>
          </div>

          <button
            onClick={() => navigate('/battles')}
            className="bg-gradient-to-br from-[#ff00a0]/20 to-[#ff00a0]/5 border border-[#ff00a0]/30 p-3 sm:p-4 rounded-2xl flex flex-col justify-center relative overflow-hidden group hover:bg-[#ff00a0]/20 transition shadow-[0_0_15px_rgba(255,0,160,0.1)] text-left"
          >
            <div className="absolute top-0 right-0 w-12 h-12 bg-[#ff00a0]/10 rounded-bl-full group-hover:scale-110 transition" />
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 relative z-10">
              <SwordIcon
                weight="fill"
                className="text-[#ff00a0] w-4 h-4 sm:w-5 sm:h-5"
              />
              <p className="text-[9px] sm:text-[10px] text-gray-300 font-semibold uppercase tracking-wider">
                Battles
              </p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-[#ff00a0] relative z-10 flex items-center gap-1">
              History <CaretRightIcon weight="bold" className="w-4 h-4" />
            </p>
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6 relative z-10">
          <div
            className="relative bg-black/50 backdrop-blur-xl border border-white/10 p-4 sm:p-5 rounded-3xl overflow-hidden group cursor-pointer"
            onClick={() => navigate('/quizzes')}
          >
            <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-[#ccff00]/20 rounded-full blur-2xl group-hover:bg-[#ccff00]/40 transition-all duration-500" />
            <div className="relative z-10 flex flex-col items-start">
              <div className="bg-[#ccff00]/20 text-[#ccff00] px-3 py-1 rounded-full text-[10px] font-bold mb-3 uppercase tracking-wider">
                {profile?.age_category || 'General'} Tier
              </div>
              <h2 className="text-base sm:text-lg font-bold mb-1">
                Ready to test your knowledge?
              </h2>
              <p className="text-gray-400 text-xs mb-4 max-w-[250px]">
                Jump straight into a quick quiz and earn points & coins to
                unlock new themes.
              </p>
              <button className="bg-[#ccff00] text-black px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)] text-xs sm:text-sm">
                Select Quiz <CaretRightIcon weight="bold" />
              </button>
            </div>
          </div>

          <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl p-3 sm:p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs sm:text-sm font-bold">Recent Activity</h3>
              <ClockIcon className="text-gray-500 w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
            {recentActivity.length === 0 ? (
              <div className="text-gray-500 text-xs text-center py-6 bg-black/20 rounded-2xl border border-white/5">
                No recent quizzes played.
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((attempt) => {
                  const totalQ =
                    attempt.correct_answers +
                    attempt.incorrect_answers +
                    attempt.unanswered_questions
                  const acc =
                    totalQ > 0
                      ? Math.round((attempt.correct_answers / totalQ) * 100)
                      : 0

                  return (
                    <div
                      key={attempt.id}
                      className="flex items-center justify-between p-2.5 sm:p-3 bg-black/40 border border-white/5 rounded-2xl"
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
                          <CheckCircleIcon
                            weight="fill"
                            className="text-[#ccff00] w-3.5 h-3.5 sm:w-4 sm:h-4"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-[11px] sm:text-xs">
                            {attempt.category_name}
                          </p>
                          <p className="text-[9px] sm:text-[10px] text-gray-500">
                            {new Date(attempt.created_at).toLocaleDateString()} • {acc}%
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-1.5 sm:gap-2">
                        <span className="font-bold text-[#ccff00] text-[10px] sm:text-xs">
                          +{attempt.score} pts
                        </span>
                        <span className="font-bold text-[#ff00a0] text-[10px] sm:text-xs flex items-center gap-0.5">
                          <CoinsIcon
                            weight="fill"
                            className="w-2.5 h-2.5 sm:w-3 sm:h-3"
                          />
                          {attempt.real_coins_earned > 0 ? `+${attempt.real_coins_earned}` : attempt.real_coins_earned}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl p-3 sm:p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[#ff00a0]/10 rounded-bl-full" />
            <div className="flex justify-between items-center mb-3 relative z-10">
              <h3 className="text-xs sm:text-sm font-bold">Daily Challenge</h3>
              <TargetIcon className="text-[#ff00a0] w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400 mb-3 relative z-10 flex flex-wrap items-center gap-1.5">
              Complete 3 quizzes today for{' '}
              <span className="font-bold text-[#ccff00] flex items-center gap-0.5">
                +25 PTS
              </span>{' '}
              <span className="text-gray-500">&</span>{' '}
              <span className="font-bold text-[#ff00a0] flex items-center gap-0.5">
                <CoinsIcon weight="fill" className="w-3 h-3" />
                +50
              </span>
            </p>
            <div className="w-full bg-white/5 rounded-full h-1.5 mb-1.5 relative z-10">
              <div
                className="bg-[#ff00a0] h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min((stats.quizzesToday / 3) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="text-[9px] sm:text-[10px] text-right text-gray-400 font-bold relative z-10">
              {stats.quizzesToday} / 3 Completed
            </p>
          </div>

          <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl p-3 sm:p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs sm:text-sm font-bold">
                Top {profile?.age_category || 'Players'}
              </h3>
              <MedalIcon
                weight="fill"
                className="text-[#ccff00] w-3.5 h-3.5 sm:w-4 sm:h-4"
              />
            </div>
            <div className="space-y-3">
              {topPlayersLoading ? (
                <div className="text-gray-500 text-xs text-center py-2">
                  Loading top players...
                </div>
              ) : topPlayers.length === 0 ? (
                <div className="text-gray-500 text-xs text-center py-2">
                  No players yet.
                </div>
              ) : (
                topPlayers.map((player, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 sm:gap-3"
                  >
                    <span
                      className={`text-[10px] sm:text-xs font-bold w-3 sm:w-4 ${
                        idx === 0
                          ? 'text-[#ccff00]'
                          : idx === 1
                          ? 'text-gray-300'
                          : 'text-[#cd7f32]'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="relative w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center">
                      <div className="absolute inset-[15%] rounded-full bg-white/10 flex items-center justify-center text-[9px] sm:text-[10px] font-bold uppercase overflow-hidden z-10">
                        {player.avatar_url ? (
                          <img
                            src={player.avatar_url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          player.display_name?.charAt(0) || 'P'
                        )}
                      </div>
                      {player.border_url && (
                        <img
                          src={player.border_url}
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20"
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] sm:text-xs font-bold truncate">
                        {player.display_name}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#ccff00]">
                        {player.points} pts
                      </span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-[#ff00a0] flex items-center gap-0.5">
                        <CoinsIcon
                          weight="fill"
                          className="w-2 h-2 sm:w-2.5 sm:h-2.5"
                        />
                        {player.coins || 0}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => navigate('/leaderboard')}
              className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[11px] sm:text-xs font-bold transition"
            >
              View Leaderboard
            </button>
          </div>
        </div>
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button className="flex flex-col items-center gap-1 text-[#ccff00]">
          <HouseIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Home</span>
        </button>
        <button
          onClick={() => navigate('/quizzes')}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"
        >
          <GameControllerIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Play</span>
        </button>
        <button
          onClick={() => navigate('/leaderboard')}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"
        >
          <TrophyIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Ranks</span>
        </button>
        <button
          onClick={() => navigate('/rewards')}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"
        >
          <ShoppingBagIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Shop</span>
        </button>
        <button
          onClick={() => navigate('/profile')}
          className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"
        >
          <UserIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Profile</span>
        </button>
      </nav>
    </div>
  )
}