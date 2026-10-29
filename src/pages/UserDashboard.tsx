// src/pages/UserDashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  TrophyIcon, LightningIcon, TargetIcon, SignOutIcon, HouseIcon,
  GameControllerIcon, ShoppingBagIcon, UserIcon, ClockIcon,
  CaretRightIcon, MedalIcon, FireIcon, CheckCircleIcon, CoinsIcon,
  GiftIcon, SwordIcon, XCircleIcon
} from '@phosphor-icons/react'
import sabtaLogo from '../assets/icons/sabta-logo.png'

export default function UserDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [equippedBorder, setEquippedBorder] = useState<string | null>(null)
  const [equippedBackground, setEquippedBackground] = useState<string | null>(null)

  // Daily Streak State
  const [showStreakModal, setShowStreakModal] = useState(false)
  const [streakReward, setStreakReward] = useState({ coins: 0, newStreak: 0 })

  // Daily Challenge Bonus State
  const [showDailyBonusModal, setShowDailyBonusModal] = useState(false)

  // ✅ PvP Incoming Battles State
  const [incomingBattles, setIncomingBattles] = useState<any[]>([])

  // ✅ Declining Modal State
  const [declineModal, setDeclineModal] = useState<{ isOpen: boolean; battleId: string | null }>({
    isOpen: false,
    battleId: null
  })
  const [declining, setDeclining] = useState(false)

  const [stats, setStats] = useState({
    totalQuizzes: 0,
    bestScore: 0,
    accuracy: 0,
    level: 1,
    quizzesToday: 0,
  })

  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [topPlayers, setTopPlayers] = useState<any[]>([])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return navigate('/')

        let { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        
        if (profileData) {
          const { data: streakResult } = await supabase.rpc('claim_daily_streak')

          if (streakResult && streakResult.status === 'success') {
            setStreakReward({ coins: streakResult.coins, newStreak: streakResult.streak })
            setShowStreakModal(true)
            profileData.current_streak = streakResult.streak
            profileData.coins = (profileData.coins || 0) + streakResult.coins
          }
          setProfile(profileData)
        }

        const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
        setAvatarUrl(profileData?.avatar_url || googleAvatar || null)

        const { data: pendingBattles } = await supabase
          .from('quiz_battles')
          .select(`id, quiz_id, challenger_id, profiles!challenger_id ( display_name, avatar_url )`)
          .eq('opponent_id', user.id)
          .eq('status', 'pending')

        if (pendingBattles) setIncomingBattles(pendingBattles)

        const { data: invData } = await supabase
          .from('user_inventory')
          .select('*, cosmetic_items(*)')
          .eq('user_id', user.id)
          .eq('is_equipped', true)
        
        if (invData) {
          const border = invData.find(i => i.cosmetic_items?.cosmetic_type === 'avatar_border')
          if (border?.cosmetic_items?.preview_url) setEquippedBorder(border.cosmetic_items.preview_url)
          
          const bg = invData.find(i => i.cosmetic_items?.cosmetic_type === 'background')
          if (bg?.cosmetic_items?.preview_url) setEquippedBackground(bg.cosmetic_items.preview_url)
        }

        const { data: attempts } = await supabase.from('quiz_attempts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        const { data: challengeResult } = await supabase.rpc('check_daily_challenge')
        
        let quizzesToday = 0
        if (challengeResult) {
          quizzesToday = challengeResult.quizzes_today
          if (challengeResult.claimed) {
            const today = new Date().toISOString().split('T')[0]
            if (profileData?.last_challenge_date !== today) {
               setShowDailyBonusModal(true)
               const { data: updatedProfile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
               if (updatedProfile) {
                 setProfile(updatedProfile)
                 profileData = updatedProfile 
               }
            }
          }
        }

        if (attempts && attempts.length > 0) {
          const quizIds = attempts.map(a => a.quiz_id)
          const { data: quizzes } = await supabase.from('quizzes').select('id, category').in('id', quizIds)

          const attemptsWithCategory = attempts.map(attempt => ({
            ...attempt,
            quizzes: quizzes?.find(q => q.id === attempt.quiz_id),
          }))

          const totalQuizzes = attempts.length
          const bestScore = totalQuizzes > 0 ? Math.max(...attempts.map(a => a.score)) : 0
          const totalCorrect = attempts.reduce((acc, curr) => acc + curr.correct_answers, 0)
          const totalQuestionsAttempted = attempts.reduce((acc, curr) => acc + (curr.correct_answers + curr.incorrect_answers + curr.unanswered_questions), 0)
          const avgAccuracy = totalQuestionsAttempted > 0 ? (totalCorrect / totalQuestionsAttempted) * 100 : 0
          const currentPoints = profileData?.points || 0
          const level = Math.floor(currentPoints / 100) + 1

          setStats({ totalQuizzes, bestScore, accuracy: Math.round(avgAccuracy), level, quizzesToday })
          setRecentActivity(attemptsWithCategory.slice(0, 3))
        }

        if (profileData?.age_category) {
          const { data: topProfiles } = await supabase
            .from('profiles')
            .select(`id, display_name, points, coins, avatar_url, user_inventory ( is_equipped, cosmetic_items ( preview_url, cosmetic_type ) )`)
            .eq('age_category', profileData.age_category)
            .order('points', { ascending: false })
            .limit(3)

          if (topProfiles) {
            const mappedPlayers = topProfiles.map((p: any) => {
              const border = p.user_inventory?.find((inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'avatar_border')
              return { ...p, border_url: border?.cosmetic_items?.preview_url || null }
            })
            setTopPlayers(mappedPlayers)
          }
        }
        setLoading(false)
      }
      fetchData()
    }, 500)

    return () => clearTimeout(timer)
  }, [navigate])

  // ✅ Custom Decline Logic
  const openDeclineModal = (battleId: string) => {
    setDeclineModal({ isOpen: true, battleId })
  }

  const confirmDecline = async () => {
    if (!declineModal.battleId) return
    setDeclining(true)

    try {
      const { error } = await supabase
        .from('quiz_battles')
        .delete()
        .eq('id', declineModal.battleId)

      if (error) throw error

      setIncomingBattles(prev => prev.filter(b => b.id !== declineModal.battleId))
      setDeclineModal({ isOpen: false, battleId: null })
    } catch (err: any) {
      alert(err.message || "Failed to decline challenge.")
    } finally {
      setDeclining(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">LOADING DASHBOARD...</div>
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex relative">
      
      {equippedBackground && (
        <div className="fixed inset-0 z-0 pointer-events-none w-full h-full overflow-hidden">
          <img src={equippedBackground} alt="bg" className="w-full h-full object-cover opacity-70 md:opacity-50 scale-105" />
          <div className="absolute inset-0 bg-[#050505]/40 md:bg-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-transparent to-[#050505] md:bg-gradient-to-br md:from-[#050505]/90 md:via-[#050505]/50 md:to-transparent" />
        </div>
      )}

      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0f1014]/90 backdrop-blur-xl flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
        <div className="flex items-center gap-3 mb-8 px-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
            <img src={sabtaLogo} alt="SabTa" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tighter">SAB<span className="text-[#ccff00]">TA</span></span>
        </div>
        <nav className="flex flex-col w-full gap-2">
          <button className="flex items-center gap-4 w-full p-3 rounded-xl bg-[#ccff00]/10 text-[#ccff00] font-bold transition"><HouseIcon weight="fill" className="w-6 h-6" /> Home</button>
          <button onClick={() => navigate('/quizzes')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz</button>
          <button onClick={() => navigate('/leaderboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><TrophyIcon weight="fill" className="w-6 h-6" /> Leaderboard</button>
          <button onClick={() => navigate('/rewards')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><ShoppingBagIcon weight="fill" className="w-6 h-6" /> Rewards Shop</button>
          <button onClick={() => navigate('/profile')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><UserIcon weight="fill" className="w-6 h-6" /> My Profile</button>
        </nav>
        <div className="mt-auto w-full">
          <button onClick={handleLogout} className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition"><SignOutIcon weight="fill" className="w-6 h-6" /> Logout</button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative z-10 w-full overflow-x-hidden">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#ff00a0]/5 rounded-full blur-[100px] pointer-events-none" />

        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 relative z-10 gap-4">
          <div>
            <h1 className="text-xl md:text-3xl font-bold mb-1 leading-tight">
              {getGreeting()}, <br className="hidden sm:block" />
              <span className="text-[#ccff00]">{profile?.display_name?.split(' ')[0] || 'Player'}</span>!
            </h1>
            <p className="text-gray-400 text-xs flex flex-wrap items-center gap-1.5 mt-1">
              <FireIcon weight="fill" className="text-[#ff00a0]" /> 
              <span className="font-bold text-white">{profile?.current_streak || 0} Day Streak</span> 
              <span>•</span> Level {stats.level} 
              <span>•</span> {profile?.age_category?.toUpperCase()} Tier
            </p>
          </div>
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2">
              <div className="bg-black/50 backdrop-blur-md border border-[#ff00a0]/30 px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <CoinsIcon weight="fill" className="text-[#ff00a0] w-4 h-4" />
                <span className="font-bold text-xs text-[#ff00a0]">{profile?.coins || 0}</span>
              </div>
              <div className="bg-black/50 backdrop-blur-md border border-white/10 px-2.5 sm:px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                <LightningIcon weight="fill" className="text-[#ccff00] w-4 h-4" />
                <span className="font-bold text-xs">{profile?.points || 0} PTS</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
                <div className="absolute inset-[15%] rounded-full bg-gradient-to-br from-[#00f0ff] to-blue-600 flex items-center justify-center font-bold text-black uppercase overflow-hidden z-10">
                  {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : profile?.display_name?.charAt(0) || 'P'}
                </div>
                {equippedBorder && <img src={equippedBorder} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />}
              </div>
              <button onClick={handleLogout} className="md:hidden bg-red-500/10 text-red-400 p-2 rounded-xl border border-red-500/20"><SignOutIcon weight="bold" className="w-4 h-4" /></button>
            </div>
          </div>
        </header>

        {/* ✅ INCOMING PVP BATTLE BANNER */}
        {incomingBattles.length > 0 && (
          <div className="mb-6 relative z-10 space-y-3">
            {incomingBattles.map((battle) => (
              <div key={battle.id} className="bg-gradient-to-r from-[#ff00a0]/20 to-[#ff00a0]/5 border border-[#ff00a0]/40 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-4 shadow-[0_0_20px_rgba(255,0,160,0.15)] animate-in slide-in-from-top-4">
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-[#ff00a0] shrink-0">
                    {battle.profiles?.avatar_url ? (
                      <img src={battle.profiles.avatar_url} alt="Challenger" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#ff00a0]/20 flex items-center justify-center text-[#ff00a0] font-bold">
                        {battle.profiles?.display_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base sm:text-lg flex items-center gap-2">
                      <SwordIcon weight="fill" className="text-[#ff00a0]" /> 
                      Incoming Challenge!
                    </h3>
                    <p className="text-sm text-gray-300">
                      <span className="font-bold text-white">{battle.profiles?.display_name}</span> has challenged you to a quiz.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* ✅ Opens Custom Modal */}
                  <button 
                    onClick={() => openDeclineModal(battle.id)}
                    className="flex-1 sm:flex-none bg-white/10 text-white px-4 py-3 rounded-xl font-bold hover:bg-red-500/20 hover:text-red-400 transition whitespace-nowrap"
                  >
                    Decline
                  </button>
                  <button 
                    onClick={() => navigate(`/play/${battle.quiz_id}?battleId=${battle.id}&opponent=true`)}
                    className="flex-1 sm:flex-none bg-[#ff00a0] text-white px-6 py-3 rounded-xl font-bold hover:bg-white hover:text-[#ff00a0] transition whitespace-nowrap shadow-lg"
                  >
                    Accept & Play
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* STATS GRID ... (unchanged) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-6 relative z-10">
          <div className="bg-black/50 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1"><GameControllerIcon weight="duotone" className="text-[#00f0ff] w-4 h-4 sm:w-5 sm:h-5" /><p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Played</p></div>
            <p className="text-xl sm:text-2xl font-bold">{stats.totalQuizzes}</p>
          </div>
          <div className="bg-black/50 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1"><TrophyIcon weight="duotone" className="text-[#ff00a0] w-4 h-4 sm:w-5 sm:h-5" /><p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Best Score</p></div>
            <p className="text-xl sm:text-2xl font-bold">{stats.bestScore} <span className="text-[10px] sm:text-xs text-gray-500">pts</span></p>
          </div>
          <div className="bg-black/50 backdrop-blur-xl border border-white/10 p-3 sm:p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1"><TargetIcon weight="duotone" className="text-[#ccff00] w-4 h-4 sm:w-5 sm:h-5" /><p className="text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Accuracy</p></div>
            <p className="text-xl sm:text-2xl font-bold">{stats.accuracy}%</p>
          </div>
          
          <button 
            onClick={() => navigate('/battles')}
            className="bg-gradient-to-br from-[#ff00a0]/20 to-[#ff00a0]/5 border border-[#ff00a0]/30 p-3 sm:p-4 rounded-2xl flex flex-col justify-center relative overflow-hidden group hover:bg-[#ff00a0]/20 transition shadow-[0_0_15px_rgba(255,0,160,0.1)] text-left"
          >
            <div className="absolute top-0 right-0 w-12 h-12 bg-[#ff00a0]/10 rounded-bl-full group-hover:scale-110 transition" />
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 relative z-10">
              <SwordIcon weight="fill" className="text-[#ff00a0] w-4 h-4 sm:w-5 sm:h-5" />
              <p className="text-[9px] sm:text-[10px] text-gray-300 font-semibold uppercase tracking-wider">Battles</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-[#ff00a0] relative z-10 flex items-center gap-1">
              History <CaretRightIcon weight="bold" className="w-4 h-4" />
            </p>
          </button>
        </div>

        {/* ... (rest of the dashboard content unchanged) */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 relative z-10">
          <div className="relative bg-black/50 backdrop-blur-xl border border-white/10 p-4 sm:p-5 rounded-3xl overflow-hidden group cursor-pointer" onClick={() => navigate('/quizzes')}>
            <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-[#ccff00]/20 rounded-full blur-2xl group-hover:bg-[#ccff00]/40 transition-all duration-500" />
            <div className="relative z-10 flex flex-col items-start">
              <div className="bg-[#ccff00]/20 text-[#ccff00] px-3 py-1 rounded-full text-[10px] font-bold mb-3 uppercase tracking-wider">{profile?.age_category || 'General'} Tier</div>
              <h2 className="text-base sm:text-lg font-bold mb-1">Ready to test your knowledge?</h2>
              <p className="text-gray-400 text-xs mb-4 max-w-[250px]">Jump straight into a quick quiz and earn points & coins to unlock new themes.</p>
              <button className="bg-[#ccff00] text-black px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)] text-xs sm:text-sm">Select Quiz <CaretRightIcon weight="bold" /></button>
            </div>
          </div>

          <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl p-3 sm:p-4">
            <div className="flex justify-between items-center mb-3"><h3 className="text-xs sm:text-sm font-bold">Recent Activity</h3><ClockIcon className="text-gray-500 w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
            {recentActivity.length === 0 ? (
              <div className="text-gray-500 text-xs text-center py-6 bg-black/20 rounded-2xl border border-white/5">No recent quizzes played.</div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((attempt) => {
                  const totalQ = attempt.correct_answers + attempt.incorrect_answers + attempt.unanswered_questions
                  const acc = totalQ > 0 ? Math.round((attempt.correct_answers / totalQ) * 100) : 0
                  const coinsEarned = attempt.score * 15 

                  return (
                    <div key={attempt.id} className="flex items-center justify-between p-2.5 sm:p-3 bg-black/40 border border-white/5 rounded-2xl">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0"><CheckCircleIcon weight="fill" className="text-[#ccff00] w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
                        <div>
                          <p className="font-bold text-[11px] sm:text-xs">{attempt.quizzes?.category || 'General Knowledge'}</p>
                          <p className="text-[9px] sm:text-[10px] text-gray-500">{new Date(attempt.created_at).toLocaleDateString()} • {acc}%</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-1.5 sm:gap-2">
                        <span className="font-bold text-[#ccff00] text-[10px] sm:text-xs">+{attempt.score} pts</span>
                        <span className="font-bold text-[#ff00a0] text-[10px] sm:text-xs flex items-center gap-0.5"><CoinsIcon weight="fill" className="w-2.5 h-2.5 sm:w-3 sm:h-3" />+{coinsEarned}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl p-3 sm:p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[#ff00a0]/10 rounded-bl-full" />
            <div className="flex justify-between items-center mb-3 relative z-10"><h3 className="text-xs sm:text-sm font-bold">Daily Challenge</h3><TargetIcon className="text-[#ff00a0] w-4 h-4 sm:w-5 sm:h-5" /></div>
            <p className="text-[11px] sm:text-xs text-gray-400 mb-3 relative z-10 flex flex-wrap items-center gap-1.5">
              Complete 3 quizzes today for <span className="font-bold text-[#ccff00] flex items-center gap-0.5">+25 PTS</span> <span className="text-gray-500">&</span> <span className="font-bold text-[#ff00a0] flex items-center gap-0.5"><CoinsIcon weight="fill" className="w-3 h-3" />+50</span>
            </p>
            <div className="w-full bg-white/5 rounded-full h-1.5 mb-1.5 relative z-10">
              <div className="bg-[#ff00a0] h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min((stats.quizzesToday / 3) * 100, 100)}%` }} />
            </div>
            <p className="text-[9px] sm:text-[10px] text-right text-gray-400 font-bold relative z-10">
              {stats.quizzesToday} / 3 Completed
            </p>
          </div>

          <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl p-3 sm:p-4">
            <div className="flex justify-between items-center mb-4"><h3 className="text-xs sm:text-sm font-bold">Top {profile?.age_category || 'Players'}</h3><MedalIcon weight="fill" className="text-[#ccff00] w-3.5 h-3.5 sm:w-4 sm:h-4" /></div>
            <div className="space-y-3">
              {topPlayers.length === 0 ? (
                <div className="text-gray-500 text-xs text-center py-2">No players yet.</div>
              ) : (
                topPlayers.map((player, idx) => (
                  <div key={idx} className="flex items-center gap-2 sm:gap-3">
                    <span className={`text-[10px] sm:text-xs font-bold w-3 sm:w-4 ${idx === 0 ? 'text-[#ccff00]' : idx === 1 ? 'text-gray-300' : 'text-[#cd7f32]'}`}>#{idx + 1}</span>
                    <div className="relative w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center">
                      <div className="absolute inset-[15%] rounded-full bg-white/10 flex items-center justify-center text-[9px] sm:text-[10px] font-bold uppercase overflow-hidden z-10">
                        {player.avatar_url ? (
                          <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          player.display_name?.charAt(0) || 'P'
                        )}
                      </div>
                      {player.border_url && (
                        <img src={player.border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                      )}
                    </div>
                    <div className="flex-1"><p className="text-[11px] sm:text-xs font-bold truncate">{player.display_name}</p></div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#ccff00]">{player.points} pts</span>
                      <span className="text-[8px] sm:text-[9px] font-bold text-[#ff00a0] flex items-center gap-0.5"><CoinsIcon weight="fill" className="w-2 h-2 sm:w-2.5 sm:h-2.5" />{player.coins || 0}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => navigate('/leaderboard')} className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-[11px] sm:text-xs font-bold transition">View Leaderboard</button>
          </div>
        </div>
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button className="flex flex-col items-center gap-1 text-[#ccff00]"><HouseIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Home</span></button>
        <button onClick={() => navigate('/quizzes')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"><GameControllerIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Play</span></button>
        <button onClick={() => navigate('/leaderboard')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"><TrophyIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Ranks</span></button>
        <button onClick={() => navigate('/rewards')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"><ShoppingBagIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Shop</span></button>
        <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"><UserIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Profile</span></button>
      </nav>

      {/* ✅ DAILY STREAK REWARD MODAL */}
      {showStreakModal && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f1014] border border-[#ff00a0]/30 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 max-w-sm w-full text-center relative shadow-[0_0_50px_rgba(255,0,160,0.2)] my-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#ff00a0] to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-[0_0_40px_rgba(255,0,160,0.4)] animate-bounce">
              <FireIcon weight="fill" className="w-10 h-10 sm:w-12 sm:h-12 text-black" />
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">Daily Streak!</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">
              You logged in today! Keep it up to earn bigger rewards.
            </p>

            <div className="bg-black/40 border border-white/10 rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
              <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase font-bold mb-1">Current Streak</p>
              <p className="text-3xl sm:text-4xl font-bold text-[#ff00a0] flex items-center justify-center gap-2">
                {streakReward.newStreak} <span className="text-base sm:text-lg text-white">Days</span>
              </p>
            </div>

            <div className="bg-[#ccff00]/10 border border-[#ccff00]/30 rounded-2xl p-3 sm:p-4 flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-2">
                <GiftIcon weight="fill" className="text-[#ccff00] w-5 h-5 sm:w-6 sm:h-6" />
                <span className="font-bold text-white text-xs sm:text-sm">Daily Reward</span>
              </div>
              <span className="font-bold text-[#ff00a0] flex items-center gap-1 text-sm sm:text-base">
                <CoinsIcon weight="fill" /> +{streakReward.coins}
              </span>
            </div>

            <button 
              onClick={() => setShowStreakModal(false)} 
              className="w-full bg-[#ccff00] text-black py-3 sm:py-4 rounded-xl font-black text-base sm:text-lg hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)]"
            >
              Claim & Continue
            </button>
          </div>
        </div>
      )}

      {/* ✅ DAILY CHALLENGE REWARD MODAL */}
      {showDailyBonusModal && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f1014] border border-[#ccff00]/30 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 max-w-sm w-full text-center relative shadow-[0_0_50px_rgba(204,255,0,0.2)] my-auto">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#ccff00] to-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-[0_0_40px_rgba(204,255,0,0.4)] animate-bounce">
              <TargetIcon weight="fill" className="w-10 h-10 sm:w-12 sm:h-12 text-black" />
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">Daily Challenge!</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">
              You completed 3 quizzes today! Here is your bonus reward.
            </p>

            <div className="bg-[#ccff00]/10 border border-[#ccff00]/30 rounded-2xl p-3 sm:p-4 flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-2">
                <GiftIcon weight="fill" className="text-[#ccff00] w-5 h-5 sm:w-6 sm:h-6" />
                <span className="font-bold text-white text-xs sm:text-sm">Challenge Reward</span>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-[#ccff00] flex items-center gap-1 text-sm sm:text-base">
                  <LightningIcon weight="fill" /> +25
                </span>
                <span className="font-bold text-[#ff00a0] flex items-center gap-1 text-sm sm:text-base">
                  <CoinsIcon weight="fill" /> +50
                </span>
              </div>
            </div>

            <button 
              onClick={() => setShowDailyBonusModal(false)} 
              className="w-full bg-[#ccff00] text-black py-3 sm:py-4 rounded-xl font-black text-base sm:text-lg hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)]"
            >
              Claim Rewards
            </button>
          </div>
        </div>
      )}

      {/* ✅ CUSTOM DECLINE MODAL */}
      {declineModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center relative shadow-[0_0_50px_rgba(255,0,160,0.1)]">
            
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg bg-[#ff00a0]/20 text-[#ff00a0]">
              <XCircleIcon weight="fill" className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Decline Challenge?</h2>
            
            <p className="text-gray-400 text-sm mb-6 sm:mb-8">
              Are you sure you want to decline this challenge? It will be removed from your list.
            </p>

            <div className="flex gap-3">
              <button 
                onClick={() => setDeclineModal({ isOpen: false, battleId: null })} 
                disabled={declining}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDecline} 
                disabled={declining}
                className="flex-1 py-3 rounded-xl font-bold transition disabled:opacity-50 text-sm shadow-lg bg-[#ff00a0] hover:bg-white text-white hover:text-[#ff00a0] shadow-[#ff00a0]/20"
              >
                {declining ? 'Processing...' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}