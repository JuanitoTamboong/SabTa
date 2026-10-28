// src/pages/Leaderboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  TrophyIcon, LightningIcon, SignOutIcon, HouseIcon,
  GameControllerIcon, ShoppingBagIcon, UserIcon,
  MedalIcon, CrownIcon, StarIcon, TimerIcon, GlobeIcon, XIcon 
} from '@phosphor-icons/react'
import sabtaLogo from '../assets/icons/sabta-logo.png'

export default function Leaderboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'global' | 'normal' | 'intermediate' | 'hard'>('global')

  // Play Menu State
  const [showPlayMenu, setShowPlayMenu] = useState(false)
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([])
  const [loadingQuizzes, setLoadingQuizzes] = useState(false)

  // ✅ Helper to format time (e.g. 90 -> "1m 30s" or 45 -> "45s")
  const formatTime = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds === 99999 || totalSeconds === 9999) return null
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (profileData) setProfile(profileData)
      if (!profileData?.age_category) { setLoading(false); return }

      let query = supabase
        .from('quiz_attempts')
        .select(`
          score,
          time_taken_seconds,
          profiles!inner (
            id, display_name, avatar_url, age_category,
            user_inventory (
              is_equipped,
              cosmetic_items ( preview_url, cosmetic_type )
            )
          ),
          quizzes!inner ( difficulty )
        `)

      if (activeTab !== 'global') {
        query = query.eq('profiles.age_category', profileData.age_category)
      }

      const { data: attempts, error } = await query

      if (!error && attempts) {
        const playerStats: Record<string, any> = {}

        attempts.forEach((attempt: any) => {
          const playerId = attempt.profiles.id
          const difficulty = attempt.quizzes.difficulty
          const attemptTime = attempt.time_taken_seconds || 99999 

          const equippedBorder = attempt.profiles.user_inventory?.find(
            (inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'border'
          )

          if (!playerStats[playerId]) {
            playerStats[playerId] = {
              id: playerId,
              display_name: attempt.profiles.display_name,
              avatar_url: attempt.profiles.avatar_url,
              age_category: attempt.profiles.age_category,
              border_url: equippedBorder?.cosmetic_items?.preview_url || null,
              scores: { normal: 0, intermediate: 0, hard: 0 },
              times: { normal: 99999, intermediate: 99999, hard: 99999 } 
            }
          }

          if (playerStats[playerId].scores[difficulty] !== undefined) {
            playerStats[playerId].scores[difficulty] += attempt.score
          }

          if (attemptTime < playerStats[playerId].times[difficulty]) {
            playerStats[playerId].times[difficulty] = attemptTime
          }
        })

        const sortedPlayers = Object.values(playerStats)
          .map((p: any) => {
            let points = 0;
            let bestTime = 99999;

            if (activeTab === 'global') {
              points = p.scores.normal + p.scores.intermediate + p.scores.hard
              bestTime = Math.min(p.times.normal, p.times.intermediate, p.times.hard)
            } else {
              points = p.scores[activeTab]
              bestTime = p.times[activeTab]
            }

            return { ...p, points, bestTime }
          })
          .filter((p: any) => p.points > 0)
          .sort((a, b) => {
            if (b.points !== a.points) {
              return b.points - a.points
            }
            return a.bestTime - b.bestTime
          })

        setPlayers(sortedPlayers)
      }

      setLoading(false)
    }

    fetchLeaderboard()
  }, [navigate, activeTab])

  const openPlayMenu = async () => {
    setShowPlayMenu(true)
    setLoadingQuizzes(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !profile?.age_category) return

      const { data: completed } = await supabase
        .from('quiz_attempts')
        .select('quiz_id')
        .eq('user_id', user.id)
        .eq('status', 'completed') 
        
      const completedIds = completed?.map(c => c.quiz_id) || []

      let query = supabase
        .from('quizzes')
        .select('id, title, category, difficulty, questions(count)')
        .eq('age_category', profile.age_category)
        .eq('status', 'published')

      if (completedIds.length > 0) {
        query = query.not('id', 'in', `(${completedIds.join(',')})`)
      }

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
    return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">LOADING RANKINGS...</div>
  }

  const currentUserRank = players.findIndex(p => p.id === profile?.id) + 1
  const currentUserPoints = players[currentUserRank - 1]?.points || 0

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
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><HouseIcon weight="fill" className="w-6 h-6" /> Home</button>
          <button onClick={openPlayMenu} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz</button>
          <button className="flex items-center gap-4 w-full p-3 rounded-xl bg-[#ccff00]/10 text-[#ccff00] font-bold transition"><TrophyIcon weight="fill" className="w-6 h-6" /> Leaderboard</button>
          <button onClick={() => navigate('/rewards')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><ShoppingBagIcon weight="fill" className="w-6 h-6" /> Rewards Shop</button>
          <button onClick={() => navigate('/profile')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><UserIcon weight="fill" className="w-6 h-6" /> My Profile</button>
        </nav>
        <div className="mt-auto w-full">
          <button onClick={handleLogout} className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition"><SignOutIcon weight="fill" className="w-6 h-6" /> Logout</button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#ccff00]/5 rounded-full blur-[100px] pointer-events-none" />

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 relative z-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">
              {activeTab === 'global' ? 'Global Rankings' : 'Tier Rankings'}
            </h1>
            <p className="text-gray-400 text-xs md:text-sm">
              {activeTab === 'global' 
                ? 'Comparing players across ALL age groups.'
                : <>You are viewing the <span className="text-[#ccff00] font-bold uppercase">{profile?.age_category}</span> tier leaderboard.</>
              }
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-[#0f1014] border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
              <LightningIcon weight="fill" className="text-[#ccff00] w-5 h-5" />
              <span className="font-bold">{profile?.points || 0} PTS</span>
            </div>
            <button onClick={handleLogout} className="md:hidden bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20">
              <SignOutIcon weight="bold" className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex flex-wrap gap-2 mb-8 relative z-10">
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm capitalize transition-all flex items-center justify-center gap-2 ${
              activeTab === 'global' 
                ? 'bg-[#ccff00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]' 
                : 'bg-[#0f1014] text-gray-400 border border-white/5 hover:border-white/20'
            }`}
          >
            <GlobeIcon weight="bold" size={18} /> Global
          </button>
          
          <div className="w-px h-8 bg-white/10 mx-2 hidden md:block" />

          {['normal', 'intermediate', 'hard'].map(diff => (
            <button
              key={diff}
              onClick={() => setActiveTab(diff as any)}
              className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm capitalize transition-all ${
                activeTab === diff 
                  ? 'bg-[#ccff00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]' 
                  : 'bg-[#0f1014] text-gray-400 border border-white/5 hover:border-white/20'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>

        {players.length === 0 ? (
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-12 text-center relative z-10">
            <TrophyIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-bold mb-1 text-lg">No scores yet</p>
            <p className="text-gray-500 text-sm">Be the first to complete a quiz!</p>
            <button onClick={openPlayMenu} className="mt-6 bg-[#ccff00] text-black px-6 py-2 rounded-xl font-bold hover:bg-white transition">
              Play Now
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 md:gap-4 mb-12 relative z-10 items-end">
              
              {/* 2nd Place */}
              {players[1] ? (
                <div className="flex flex-col items-center">
                  <div className="relative mb-2 w-16 h-16 md:w-20 md:h-20">
                    <div className="absolute inset-[15%] rounded-full bg-gray-300 overflow-hidden flex items-center justify-center text-black font-bold text-xl uppercase shadow-lg z-10">
                      {players[1].avatar_url ? (
                        <img src={players[1].avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        players[1].display_name?.charAt(0)
                      )}
                    </div>
                    {players[1].border_url && (
                      <img src={players[1].border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                    )}
                  </div>
                  <div className="bg-[#0f1014] w-full rounded-t-xl border border-white/10 p-2 md:p-4 text-center pb-6 md:pb-8">
                    <MedalIcon weight="fill" className="text-gray-300 w-6 h-6 mx-auto mb-1" />
                    <p className="text-xs md:text-sm font-bold truncate">{players[1].display_name}</p>
                    {activeTab === 'global' && <p className="text-[8px] text-gray-500 uppercase font-bold">{players[1].age_category}</p>}
                    <p className="text-[10px] md:text-xs text-gray-400 font-bold">{players[1].points} PTS</p>
                  </div>
                </div>
              ) : <div />}

              {/* 1st Place */}
              {players[0] && (
                <div className="flex flex-col items-center">
                  <CrownIcon weight="fill" className="text-[#ccff00] w-8 h-8 mb-1 animate-bounce" />
                  <div className="relative mb-2 w-20 h-20 md:w-24 md:h-24">
                    <div className="absolute inset-[15%] rounded-full bg-[#ccff00] overflow-hidden flex items-center justify-center text-black font-bold text-2xl uppercase shadow-[0_0_30px_rgba(204,255,0,0.4)] z-10">
                      {players[0].avatar_url ? (
                        <img src={players[0].avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        players[0].display_name?.charAt(0)
                      )}
                    </div>
                    {players[0].border_url && (
                      <img src={players[0].border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                    )}
                  </div>
                  <div className="bg-[#141a10] w-full rounded-t-xl border border-[#ccff00]/30 p-2 md:p-4 text-center pb-8 md:pb-12 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-[#ccff00]/10 to-transparent" />
                    <StarIcon weight="fill" className="text-[#ccff00] w-6 h-6 mx-auto mb-1 relative z-10" />
                    <p className="text-sm md:text-base font-bold truncate relative z-10">{players[0].display_name}</p>
                    {activeTab === 'global' && <p className="text-[8px] text-[#ccff00]/70 uppercase font-bold relative z-10">{players[0].age_category}</p>}
                    <p className="text-xs md:text-sm text-[#ccff00] font-bold relative z-10">{players[0].points} PTS</p>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {players[2] ? (
                <div className="flex flex-col items-center">
                  <div className="relative mb-2 w-16 h-16 md:w-20 md:h-20">
                    <div className="absolute inset-[15%] rounded-full bg-[#cd7f32] overflow-hidden flex items-center justify-center text-black font-bold text-xl uppercase shadow-lg z-10">
                      {players[2].avatar_url ? (
                        <img src={players[2].avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        players[2].display_name?.charAt(0)
                      )}
                    </div>
                    {players[2].border_url && (
                      <img src={players[2].border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                    )}
                  </div>
                  <div className="bg-[#0f1014] w-full rounded-t-xl border border-white/10 p-2 md:p-4 text-center pb-6 md:pb-8">
                    <MedalIcon weight="fill" className="text-[#cd7f32] w-6 h-6 mx-auto mb-1" />
                    <p className="text-xs md:text-sm font-bold truncate">{players[2].display_name}</p>
                    {activeTab === 'global' && <p className="text-[8px] text-gray-500 uppercase font-bold">{players[2].age_category}</p>}
                    <p className="text-[10px] md:text-xs text-gray-400 font-bold">{players[2].points} PTS</p>
                  </div>
                </div>
              ) : <div />}
            </div>

            <div className="bg-[#0f1014] border border-white/10 rounded-3xl overflow-hidden relative z-10">
              <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5 bg-black/20 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span>Rank</span>
                <span className="flex-1 ml-4">Player</span>
                <span className="capitalize">{activeTab === 'global' ? 'Total' : activeTab} PTS</span>
              </div>
              
              <div className="divide-y divide-white/5">
                {players.slice(3).map((player, idx) => {
                  const rank = idx + 4
                  const isMe = player.id === profile?.id

                  return (
                    <div key={player.id} className={`flex items-center p-4 md:p-6 transition ${isMe ? 'bg-[#ccff00]/5' : 'hover:bg-white/5'}`}>
                      <span className={`w-8 md:w-12 font-mono font-bold text-sm md:text-base ${isMe ? 'text-[#ccff00]' : 'text-gray-500'}`}>
                        #{rank}
                      </span>
                      <div className="flex-1 ml-2 md:ml-4 flex items-center gap-3 md:gap-4">
                        
                        <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0">
                          <div className={`absolute inset-[15%] rounded-full flex items-center justify-center font-bold uppercase overflow-hidden ${isMe ? 'bg-[#ccff00] text-black' : 'bg-white/10 text-white'}`}>
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              player.display_name?.charAt(0)
                            )}
                          </div>
                          {player.border_url && (
                            <img src={player.border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                          )}
                        </div>

                        <div>
                          <span className={`font-bold text-sm md:text-base truncate block ${isMe ? 'text-[#ccff00]' : 'text-white'}`}>
                            {player.display_name} {isMe && '(You)'}
                          </span>
                          {activeTab === 'global' && (
                            <span className="text-[9px] uppercase font-bold text-gray-500">{player.age_category}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* ✅ FIXED: Always show the badge, but show a dash if there is no recorded time */}
                        <span className="text-xs text-gray-400 hidden md:flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
                          <TimerIcon size={14} className={formatTime(player.bestTime) ? "text-[#ccff00]" : "text-gray-600"} /> 
                          {formatTime(player.bestTime) || '-'}
                        </span>
                        
                        <span className="font-bold text-sm md:text-base flex items-center gap-1">
                          <LightningIcon weight="fill" className="text-[#ccff00] w-4 h-4" />
                          {player.points}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {currentUserRank > 3 && (
              <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-72 lg:right-12 bg-[#ccff00] text-black p-4 rounded-2xl shadow-[0_10px_30px_rgba(204,255,0,0.3)] flex items-center justify-between z-40">
                <div className="flex items-center gap-3">
                  <span className="font-bold font-mono text-lg">#{currentUserRank}</span>
                  
                  <div className="relative w-10 h-10">
                    <div className="absolute inset-[15%] rounded-full bg-black flex items-center justify-center text-[#ccff00] font-bold uppercase overflow-hidden z-10">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        profile?.display_name?.charAt(0)
                      )}
                    </div>
                    {players[currentUserRank - 1]?.border_url && (
                      <img src={players[currentUserRank - 1].border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                    )}
                  </div>

                  <span className="font-bold">{profile?.display_name} (You)</span>
                </div>
                <span className="font-bold flex items-center gap-1">
                  <LightningIcon weight="fill" /> {currentUserPoints}
                </span>
              </div>
            )}
          </>
        )}
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <HouseIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Home</span>
        </button>
        <button onClick={openPlayMenu} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <GameControllerIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Play</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[#ccff00]">
          <TrophyIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Ranks</span>
        </button>
        <button onClick={() => navigate('/rewards')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <ShoppingBagIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Shop</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <UserIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Profile</span>
        </button>
      </nav>

      {showPlayMenu && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-6 md:p-8 max-w-md w-full shadow-2xl relative">
            <button onClick={() => setShowPlayMenu(false)} className="absolute top-6 right-6 text-gray-400 hover:text-white transition"><XIcon weight="bold" size={24} /></button>
            <h2 className="text-2xl font-bold mb-1">Choose a Challenge</h2>
            <p className="text-gray-400 text-sm mb-6">Select a quiz to play & earn coins.</p>
            <div className="flex items-center justify-between mb-4 bg-[#ff00a0]/5 border border-[#ff00a0]/20 rounded-xl px-4 py-2">
              <span className="text-xs text-gray-400 font-semibold">Your Balance</span>
              <div className="flex items-center gap-1.5"><LightningIcon weight="fill" className="text-[#ff00a0] w-4 h-4" /><span className="font-bold text-[#ff00a0] text-sm">{profile?.coins || 0}</span></div>
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