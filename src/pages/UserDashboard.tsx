// src/pages/UserDashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  TrophyIcon, LightningIcon, TargetIcon, SignOutIcon, HouseIcon,
  GameControllerIcon, ShoppingBagIcon, UserIcon, ClockIcon,
  CaretRightIcon, MedalIcon, FireIcon, CheckCircleIcon, XIcon, CoinsIcon,
} from '@phosphor-icons/react'
import sabtaLogo from '../assets/icons/sabta-logo.png'

export default function UserDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [equippedBorder, setEquippedBorder] = useState<string | null>(null)

  const [stats, setStats] = useState({
    totalQuizzes: 0,
    bestScore: 0,
    accuracy: 0,
    level: 1,
    quizzesToday: 0,
    coinsEarnedToday: 0,
  })

  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [topPlayers, setTopPlayers] = useState<any[]>([])

  // Play Menu State
  const [showPlayMenu, setShowPlayMenu] = useState(false)
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([])
  const [loadingQuizzes, setLoadingQuizzes] = useState(false)

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  useEffect(() => {
    // ✅ Add a 500ms delay to ensure the quiz results have finished saving to the database
    const timer = setTimeout(() => {
      const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return navigate('/')

        // 1. Get User Avatar
        if (user.user_metadata?.avatar_url || user.user_metadata?.picture) {
          setAvatarUrl(user.user_metadata.avatar_url || user.user_metadata.picture)
        }

        // 2. Fetch Profile
        const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
        if (profileData) setProfile(profileData)

        // 3. Fetch Equipped Border
        const { data: invData } = await supabase
          .from('user_inventory')
          .select('*, cosmetic_items(*)')
          .eq('user_id', user.id)
          .eq('is_equipped', true)
        
        if (invData) {
          const border = invData.find(i => i.cosmetic_items?.cosmetic_type === 'border')
          if (border?.cosmetic_items?.preview_url) {
            setEquippedBorder(border.cosmetic_items.preview_url)
          }
        }

        // 4. Fetch Attempts
        const { data: attempts } = await supabase.from('quiz_attempts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })

        if (attempts && attempts.length > 0) {
          const quizIds = attempts.map(a => a.quiz_id)
          const { data: quizzes } = await supabase.from('quizzes').select('id, category').in('id', quizIds)

          const attemptsWithCategory = attempts.map(attempt => ({
            ...attempt,
            quizzes: quizzes?.find(q => q.id === attempt.quiz_id),
          }))

          const totalQuizzes = attempts.length
          const bestScore = totalQuizzes > 0 ? Math.max(...attempts.map(a => a.score)) : 0
          const avgAccuracy = totalQuizzes > 0 ? attempts.reduce((acc, curr) => acc + (curr.accuracy || 0), 0) / totalQuizzes : 0
          const currentPoints = profileData?.points || 0
          const level = Math.floor(currentPoints / 100) + 1
          const today = new Date().toISOString().split('T')[0]
          const todayAttempts = attempts.filter(a => a.created_at.startsWith(today))
          const quizzesToday = todayAttempts.length
          const coinsEarnedToday = todayAttempts.reduce((sum, a) => sum + (a.correct_answers * 150), 0)

          setStats({ totalQuizzes, bestScore, accuracy: Math.round(avgAccuracy), level, quizzesToday, coinsEarnedToday })
          setRecentActivity(attemptsWithCategory.slice(0, 3))
        }

        // 5. Fetch Top Players (WITH EQUIPPED BORDERS)
        if (profileData?.age_category) {
          const { data: topProfiles } = await supabase
            .from('profiles')
            .select(`
              id, display_name, points, coins, avatar_url,
              user_inventory (
                is_equipped,
                cosmetic_items ( preview_url, cosmetic_type )
              )
            `)
            .eq('age_category', profileData.age_category)
            .order('points', { ascending: false })
            .limit(3)

          if (topProfiles) {
            const mappedPlayers = topProfiles.map((p: any) => {
              const border = p.user_inventory?.find((inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'border')
              return {
                ...p,
                border_url: border?.cosmetic_items?.preview_url || null
              }
            })
            setTopPlayers(mappedPlayers)
          }
        }
        setLoading(false)
      }
      fetchData()
    }, 500) // 500ms delay

    return () => clearTimeout(timer)
  }, [navigate])

  const openPlayMenu = async () => {
    setShowPlayMenu(true)
    setLoadingQuizzes(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !profile?.age_category) return

      const { data: completed } = await supabase.from('quiz_attempts').select('quiz_id').eq('user_id', user.id)
      const completedIds = completed?.map(c => c.quiz_id) || []

      let query = supabase.from('quizzes').select('id, title, category, difficulty, questions(count)').eq('age_category', profile.age_category).eq('status', 'published')
      if (completedIds.length > 0) query = query.not('id', 'in', `(${completedIds.join(',')})`)

      const { data: quizzes } = await query
      setAvailableQuizzes((quizzes || []).filter(q => (q.questions as any)?.[0]?.count > 0))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingQuizzes(false)
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
    <div className="min-h-screen bg-[#050505] text-white flex">
      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0f1014] flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
        <div className="flex items-center gap-3 mb-8 px-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
            <img src={sabtaLogo} alt="SabTa" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tighter">SAB<span className="text-[#ccff00]">TA</span></span>
        </div>
        <nav className="flex flex-col w-full gap-2">
          <button className="flex items-center gap-4 w-full p-3 rounded-xl bg-[#ccff00]/10 text-[#ccff00] font-bold transition"><HouseIcon weight="fill" className="w-6 h-6" /> Home</button>
          <button onClick={openPlayMenu} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz</button>
          <button onClick={() => navigate('/leaderboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><TrophyIcon weight="fill" className="w-6 h-6" /> Leaderboard</button>
          <button onClick={() => navigate('/rewards')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><ShoppingBagIcon weight="fill" className="w-6 h-6" /> Rewards Shop</button>
          <button onClick={() => navigate('/profile')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><UserIcon weight="fill" className="w-6 h-6" /> My Profile</button>
        </nav>
        <div className="w-full mt-4 p-3 bg-gradient-to-br from-[#ff00a0]/10 to-transparent border border-[#ff00a0]/20 rounded-xl">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Coin Balance</p>
          <div className="flex items-center gap-2"><CoinsIcon weight="fill" className="text-[#ff00a0] w-5 h-5" /><span className="font-bold text-[#ff00a0]">{profile?.coins || 0}</span></div>
        </div>
        <div className="mt-auto w-full">
          <button onClick={handleLogout} className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition"><SignOutIcon weight="fill" className="w-6 h-6" /> Logout</button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#ff00a0]/5 rounded-full blur-[100px] pointer-events-none" />

        <header className="flex justify-between items-center mb-6 relative z-10">
          <div>
            <h1 className="text-xl md:text-3xl font-bold mb-1 leading-tight">
              {getGreeting()}, <br className="md:hidden" />
              <span className="text-[#ccff00]">{profile?.display_name?.split(' ')[0] || 'Player'}</span>!
            </h1>
            <p className="text-gray-400 text-xs flex items-center gap-2 mt-1"><FireIcon weight="fill" className="text-[#ff00a0]" /> Level {stats.level} • {profile?.age_category?.toUpperCase()} Tier</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-[#0f1014] border border-[#ff00a0]/30 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <CoinsIcon weight="fill" className="text-[#ff00a0] w-4 h-4" />
              <span className="font-bold text-xs text-[#ff00a0]">{profile?.coins || 0}</span>
            </div>
            <div className="bg-[#0f1014] border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <LightningIcon weight="fill" className="text-[#ccff00] w-4 h-4" />
              <span className="font-bold text-xs">{profile?.points || 0} PTS</span>
            </div>
            
            <div className="relative w-9 h-9">
              <div className="absolute inset-[15%] rounded-full bg-gradient-to-br from-[#00f0ff] to-blue-600 flex items-center justify-center font-bold text-black uppercase overflow-hidden z-10">
                {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : profile?.display_name?.charAt(0) || 'P'}
              </div>
              {equippedBorder && <img src={equippedBorder} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />}
            </div>

            <button onClick={handleLogout} className="md:hidden bg-red-500/10 text-red-400 p-2 rounded-xl border border-red-500/20"><SignOutIcon weight="bold" className="w-4 h-4" /></button>
          </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 relative z-10">
          <div className="bg-[#0f1014] border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1"><GameControllerIcon weight="duotone" className="text-[#00f0ff] w-5 h-5" /><p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Played</p></div>
            <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
          </div>
          <div className="bg-[#0f1014] border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1"><TrophyIcon weight="duotone" className="text-[#ff00a0] w-5 h-5" /><p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Best Score</p></div>
            <p className="text-2xl font-bold">{stats.bestScore} <span className="text-xs text-gray-500">pts</span></p>
          </div>
          <div className="bg-[#0f1014] border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1"><TargetIcon weight="duotone" className="text-[#ccff00] w-5 h-5" /><p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Accuracy</p></div>
            <p className="text-2xl font-bold">{stats.accuracy}%</p>
          </div>
          <div className="bg-[#0f1014] border border-white/10 p-4 rounded-2xl flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-[#00f0ff]/10 rounded-bl-full" />
            <div className="flex items-center gap-2 mb-1 relative z-10"><MedalIcon weight="duotone" className="text-[#00f0ff] w-5 h-5" /><p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Level</p></div>
            <p className="text-2xl font-bold relative z-10">{stats.level}</p>
          </div>
          <div className="bg-[#0f1014] border border-[#ff00a0]/20 p-4 rounded-2xl flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-[#ff00a0]/10 rounded-bl-full" />
            <div className="flex items-center gap-2 mb-1 relative z-10"><CoinsIcon weight="fill" className="text-[#ff00a0] w-5 h-5" /><p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Coins</p></div>
            <p className="text-2xl font-bold relative z-10 text-[#ff00a0]">{profile?.coins || 0}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 relative z-10">
          <div className="relative bg-gradient-to-r from-[#111] to-[#1a1a1a] border border-white/10 p-5 rounded-3xl overflow-hidden group cursor-pointer" onClick={openPlayMenu}>
            <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-[#ccff00]/20 rounded-full blur-2xl group-hover:bg-[#ccff00]/40 transition-all duration-500" />
            <div className="relative z-10 flex flex-col items-start">
              <div className="bg-[#ccff00]/20 text-[#ccff00] px-3 py-1 rounded-full text-[10px] font-bold mb-3 uppercase tracking-wider">{profile?.age_category || 'General'} Tier</div>
              <h2 className="text-lg font-bold mb-1">Ready to test your knowledge?</h2>
              <p className="text-gray-400 text-xs mb-4 max-w-[250px]">Jump straight into a quick quiz and earn points & coins to unlock new themes.</p>
              <button className="bg-[#ccff00] text-black px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)] text-sm">Select Quiz <CaretRightIcon weight="bold" /></button>
            </div>
          </div>

          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-4">
            <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold">Recent Activity</h3><ClockIcon className="text-gray-500 w-4 h-4" /></div>
            {recentActivity.length === 0 ? (
              <div className="text-gray-500 text-xs text-center py-6 bg-black/20 rounded-2xl border border-white/5">No recent quizzes played.</div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><CheckCircleIcon weight="fill" className="text-[#ccff00] w-4 h-4" /></div>
                      <div>
                        <p className="font-bold text-xs">{attempt.quizzes?.category || 'General Knowledge'}</p>
                        <p className="text-[10px] text-gray-500">{new Date(attempt.created_at).toLocaleDateString()} • {attempt.accuracy}%</p>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <span className="font-bold text-[#ccff00] text-xs">+{attempt.score} pts</span>
                      <span className="font-bold text-[#ff00a0] text-xs flex items-center gap-0.5"><CoinsIcon weight="fill" className="w-3 h-3" />+{attempt.correct_answers * 150}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[#ff00a0]/10 rounded-bl-full" />
            <div className="flex justify-between items-center mb-3 relative z-10"><h3 className="text-sm font-bold">Daily Challenge</h3><TargetIcon className="text-[#ff00a0] w-5 h-5" /></div>
            <p className="text-xs text-gray-400 mb-3 relative z-10 flex items-center gap-1.5">
              Complete 3 quizzes today for <span className="font-bold text-[#ccff00] flex items-center gap-0.5">+50 PTS</span> <span className="text-gray-500">&</span> <span className="font-bold text-[#ff00a0] flex items-center gap-0.5"><CoinsIcon weight="fill" className="w-3 h-3" />+50</span>
            </p>
            <div className="w-full bg-white/5 rounded-full h-1.5 mb-1.5 relative z-10">
              <div className="bg-[#ff00a0] h-1.5 rounded-full transition-all duration-500" style={{ width: `${Math.min((stats.quizzesToday / 3) * 100, 100)}%` }} />
            </div>
            <p className="text-[10px] text-right text-gray-400 font-bold relative z-10">
              {stats.quizzesToday} / 3 Completed
              {stats.coinsEarnedToday > 0 && (<span className="ml-2 text-[#ff00a0]">• +{stats.coinsEarnedToday} coins today</span>)}
            </p>
          </div>

          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-4">
            <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold">Top {profile?.age_category || 'Players'}</h3><MedalIcon weight="fill" className="text-[#ccff00] w-4 h-4" /></div>
            <div className="space-y-3">
              {topPlayers.length === 0 ? (
                <div className="text-gray-500 text-xs text-center py-2">No players yet.</div>
              ) : (
                topPlayers.map((player, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-4 ${idx === 0 ? 'text-[#ccff00]' : idx === 1 ? 'text-gray-300' : 'text-[#cd7f32]'}`}>#{idx + 1}</span>
                    <div className="relative w-8 h-8 shrink-0">
                      <div className="absolute inset-[15%] rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold uppercase overflow-hidden z-10">
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
                    <div className="flex-1"><p className="text-xs font-bold truncate">{player.display_name}</p></div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-[10px] font-bold text-[#ccff00]">{player.points} pts</span>
                      <span className="text-[9px] font-bold text-[#ff00a0] flex items-center gap-0.5"><CoinsIcon weight="fill" className="w-2.5 h-2.5" />{player.coins || 0}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button onClick={() => navigate('/leaderboard')} className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold transition">View Leaderboard</button>
          </div>
        </div>
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button className="flex flex-col items-center gap-1 text-[#ccff00]"><HouseIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Home</span></button>
        <button onClick={openPlayMenu} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"><GameControllerIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Play</span></button>
        <button onClick={() => navigate('/leaderboard')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"><TrophyIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Ranks</span></button>
        <button onClick={() => navigate('/rewards')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"><ShoppingBagIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Shop</span></button>
        <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition"><UserIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Profile</span></button>
      </nav>

      {showPlayMenu && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setShowPlayMenu(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white transition"><XIcon weight="bold" size={24} /></button>
            <h2 className="text-2xl font-bold mb-1">Choose a Challenge</h2>
            <p className="text-gray-400 text-sm mb-6">Select a quiz to play & earn coins.</p>
            <div className="flex items-center justify-between mb-4 bg-[#ff00a0]/5 border border-[#ff00a0]/20 rounded-xl px-4 py-2">
              <span className="text-xs text-gray-400 font-semibold">Your Balance</span>
              <div className="flex items-center gap-1.5"><CoinsIcon weight="fill" className="text-[#ff00a0] w-4 h-4" /><span className="font-bold text-[#ff00a0] text-sm">{profile?.coins || 0}</span></div>
            </div>
            <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
              {loadingQuizzes ? (
                <p className="text-center text-[#ccff00] font-mono text-sm py-4 animate-pulse">LOADING...</p>
              ) : availableQuizzes.length === 0 ? (
                <div className="text-center py-8 bg-black/20 rounded-2xl border border-white/5">
                  <TrophyIcon weight="duotone" className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm font-bold">All caught up!</p>
                  <p className="text-gray-500 text-xs mt-1">You've completed all available quizzes for your tier.</p>
                </div>
              ) : (
                availableQuizzes.map((q) => (
                  <button key={q.id} onClick={() => { setShowPlayMenu(false); navigate(`/play/${q.id}`) }} className="w-full text-left bg-black/40 border border-white/10 rounded-2xl p-4 hover:border-[#ccff00]/50 hover:bg-[#ccff00]/5 transition group flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm text-white group-hover:text-[#ccff00] transition">{q.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{q.category}</p>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border ${q.difficulty === 'hard' ? 'bg-red-500/10 text-red-400 border-red-500/20' : q.difficulty === 'intermediate' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>{q.difficulty}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}