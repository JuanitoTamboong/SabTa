// src/pages/Leaderboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  TrophyIcon, LightningIcon, SignOutIcon, HouseIcon,
  GameControllerIcon, ShoppingBagIcon, UserIcon,
  MedalIcon, CrownIcon, StarIcon, TimerIcon, GlobeIcon,
  CoinsIcon 
} from '@phosphor-icons/react'
import { fetchAllBadges, getPlayerBadge, type BadgeInfo } from '../lib/badges'
import sabtaLogo from '../assets/icons/sabta-logo.png'

export default function Leaderboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'global' | 'normal' | 'intermediate' | 'hard'>('global')
  
  // 🔧 Badge State
  const [allBadges, setAllBadges] = useState<BadgeInfo[]>([])

  // State for equipped background
  const [equippedBackground, setEquippedBackground] = useState<string | null>(null)

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

      // 🔧 Fetch Badges
      const badgesData = await fetchAllBadges()
      setAllBadges(badgesData)

      // 1. Fetch Profile & Equipped Background
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (profileData) setProfile(profileData)
      if (!profileData?.age_category) { setLoading(false); return }

      const { data: myInventory } = await supabase
        .from('user_inventory')
        .select('is_equipped, cosmetic_items(cosmetic_type, preview_url)')
        .eq('user_id', user.id)
        .eq('is_equipped', true)

      if (myInventory) {
        const bg = myInventory.find(i => (i.cosmetic_items as any)?.cosmetic_type === 'background')
        if (bg && (bg.cosmetic_items as any)?.preview_url) {
          setEquippedBackground((bg.cosmetic_items as any).preview_url)
        }
      }

      // 2. Fetch all profiles (to get their total real points)
      let profileQuery = supabase
        .from('profiles')
        .select(`
          id, display_name, avatar_url, age_category, points,
          user_inventory (
            is_equipped,
            cosmetic_items ( preview_url, cosmetic_type )
          )
        `)

      if (activeTab !== 'global') {
        profileQuery = profileQuery.eq('age_category', profileData.age_category)
      }

      const { data: allProfiles, error: profileError } = await profileQuery

      // 3. Fetch all attempts (to calculate difficulty breakdowns and times)
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('user_id, score, time_taken_seconds, quizzes(difficulty)')

      if (!profileError && allProfiles && attempts) {
        
        const playerStats = allProfiles.map((p: any) => {
          const equippedBorder = p.user_inventory?.find(
            (inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'avatar_border'
          )

          // Calculate quiz scores per difficulty
          let quizNormal = 0, quizIntermediate = 0, quizHard = 0
          let bestTimeNormal = 99999, bestTimeIntermediate = 99999, bestTimeHard = 99999

          const pAttempts = attempts.filter(a => a.user_id === p.id)
          
          pAttempts.forEach((a: any) => {
            const diff = a.quizzes?.difficulty
            if (diff === 'normal') {
              quizNormal += a.score
              if (a.time_taken_seconds && a.time_taken_seconds < bestTimeNormal) bestTimeNormal = a.time_taken_seconds
            } else if (diff === 'intermediate') {
              quizIntermediate += a.score
              if (a.time_taken_seconds && a.time_taken_seconds < bestTimeIntermediate) bestTimeIntermediate = a.time_taken_seconds
            } else if (diff === 'hard') {
              quizHard += a.score
              if (a.time_taken_seconds && a.time_taken_seconds < bestTimeHard) bestTimeHard = a.time_taken_seconds
            }
          })

          const totalQuizPoints = quizNormal + quizIntermediate + quizHard
          const bonusPoints = Math.max(0, (p.points || 0) - totalQuizPoints)

          let displayPoints = 0
          let displayTime = 99999

          if (activeTab === 'global') {
            displayPoints = totalQuizPoints + bonusPoints
            displayTime = Math.min(bestTimeNormal, bestTimeIntermediate, bestTimeHard)
          } else if (activeTab === 'normal') {
            displayPoints = quizNormal
            displayTime = bestTimeNormal
          } else if (activeTab === 'intermediate') {
            displayPoints = quizIntermediate
            displayTime = bestTimeIntermediate
          } else if (activeTab === 'hard') {
            displayPoints = quizHard
            displayTime = bestTimeHard
          }

          return {
            id: p.id,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            age_category: p.age_category,
            points: displayPoints,
            bestTime: displayTime,
            border_url: equippedBorder?.cosmetic_items?.preview_url || null,
          }
        })
        .filter((p: any) => p.points > 0)
        .sort((a, b) => {
          if (b.points !== a.points) {
            return b.points - a.points
          }
          return a.bestTime - b.bestTime
        })

        setPlayers(playerStats)
      }

      setLoading(false)
    }

    fetchLeaderboard()
  }, [navigate, activeTab])

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
        <div className="flex items-center gap-3 mb-8 px-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
             <img src={sabtaLogo} alt="SabTa" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tighter">SAB<span className="text-[#ccff00]">TA</span></span>
        </div>
        <nav className="flex flex-col w-full gap-2">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><HouseIcon weight="fill" className="w-6 h-6" /> Home</button>
          <button onClick={() => navigate('/quizzes')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz</button>
          <button className="flex items-center gap-4 w-full p-3 rounded-xl bg-[#ccff00]/10 text-[#ccff00] font-bold transition"><TrophyIcon weight="fill" className="w-6 h-6" /> Leaderboard</button>
          <button onClick={() => navigate('/rewards')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><ShoppingBagIcon weight="fill" className="w-6 h-6" /> Rewards Shop</button>
          <button onClick={() => navigate('/profile')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><UserIcon weight="fill" className="w-6 h-6" /> My Profile</button>
        </nav>
        <div className="mt-auto w-full">
          <button onClick={handleLogout} className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition"><SignOutIcon weight="fill" className="w-6 h-6" /> Logout</button>
        </div>
      </aside>

      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative z-10 w-full overflow-x-hidden">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 relative z-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">
              {activeTab === 'global' ? 'Global Rankings' : 'Tier Rankings'}
            </h1>
            <p className="text-gray-400 text-xs md:text-sm">
              {activeTab === 'global' 
                ? 'Comparing players across ALL age groups including bonus points.'
                : <>You are viewing the <span className="text-[#ccff00] font-bold uppercase">{profile?.age_category}</span> {activeTab} leaderboard.</>
              }
            </p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-black/50 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2">
              <LightningIcon weight="fill" className="text-[#ccff00] w-5 h-5" />
              <span className="font-bold">{profile?.points || 0} PTS</span>
            </div>
            <button onClick={handleLogout} className="md:hidden bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20">
              <SignOutIcon weight="bold" className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* TABS */}
        <div className="flex flex-wrap gap-2 mb-8 relative z-10">
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 md:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm capitalize transition-all flex items-center justify-center gap-2 ${
              activeTab === 'global' 
                ? 'bg-[#ccff00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]' 
                : 'bg-black/40 backdrop-blur-md text-gray-400 border border-white/5 hover:border-white/20'
            }`}
          >
            <GlobeIcon weight="bold" size={16} className="sm:w-[18px] sm:h-[18px]" /> Global
          </button>
          
          <div className="w-px h-8 bg-white/10 mx-1 sm:mx-2 hidden md:block self-center" />

          {['normal', 'intermediate', 'hard'].map(diff => (
            <button
              key={diff}
              onClick={() => setActiveTab(diff as any)}
              className={`flex-1 md:flex-none px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm capitalize transition-all ${
                activeTab === diff 
                  ? 'bg-[#ccff00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]' 
                  : 'bg-black/40 backdrop-blur-md text-gray-400 border border-white/5 hover:border-white/20'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>

        {players.length === 0 ? (
          <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-3xl p-12 text-center relative z-10">
            <TrophyIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 font-bold mb-1 text-lg">No scores yet</p>
            <p className="text-gray-500 text-sm">Be the first to complete a quiz!</p>
            <button onClick={() => navigate('/quizzes')} className="mt-6 bg-[#ccff00] text-black px-6 py-2 rounded-xl font-bold hover:bg-white transition">
              Play Now
            </button>
          </div>
        ) : (
          <>
            {/* TOP 3 PODIUM */}
            <div className="grid grid-cols-3 gap-2 md:gap-6 mb-12 relative z-10 items-end max-w-3xl mx-auto mt-8">
              
              {/* 2nd Place */}
              {players[1] ? (
                <div 
                  onClick={() => navigate(`/player/${players[1].id}`)}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className="relative mb-3 sm:mb-4 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 flex items-center justify-center transition-transform hover:scale-105">
                    <div className="w-[70%] h-[70%] rounded-full bg-[#1a1c23] overflow-hidden flex items-center justify-center text-gray-300 font-bold text-lg sm:text-xl uppercase shadow-lg z-10 border border-white/10">
                      {players[1].avatar_url ? (
                        <img src={players[1].avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        players[1].display_name?.charAt(0)
                      )}
                    </div>
                    {players[1].border_url && (
                      <img src={players[1].border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20 drop-shadow-md" />
                    )}
                    <div className="absolute -bottom-2 -right-2 bg-[#0f1014] border border-gray-400 text-gray-300 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm z-30 shadow-lg">#2</div>
                  </div>
                  <div className="bg-gradient-to-t from-[#1a1c23]/90 to-[#0f1014]/90 backdrop-blur-md w-full rounded-t-2xl border-t border-x border-gray-500/30 p-2 sm:p-4 text-center pb-6 sm:pb-8 relative shadow-[0_-10px_20px_rgba(255,255,255,0.02)] group-hover:border-gray-400 transition-colors">
                    <MedalIcon weight="fill" className="text-gray-400 w-5 h-5 sm:w-7 sm:h-7 mx-auto mb-1 sm:mb-2" />
                    
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <p className="text-[10px] sm:text-sm font-bold truncate text-gray-200 group-hover:text-white transition-colors">{players[1].display_name}</p>
                      {/* 🔧 BADGE 2ND */}
                      {(() => {
                        const b = getPlayerBadge(players[1].points, allBadges);
                        return b ? <img src={b.image_url} alt={b.name} title={b.name} className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" /> : null;
                      })()}
                    </div>

                    {activeTab === 'global' && <p className="text-[7px] sm:text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">{players[1].age_category}</p>}
                    <p className="text-[10px] sm:text-xs text-gray-300 font-black mt-1 sm:mt-2">{players[1].points} PTS</p>
                  </div>
                </div>
              ) : <div />}

              {/* 1st Place */}
              {players[0] && (
                <div 
                  onClick={() => navigate(`/player/${players[0].id}`)}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <CrownIcon weight="fill" className="text-[#ccff00] w-8 h-8 sm:w-10 sm:h-10 mb-2 animate-bounce drop-shadow-[0_0_15px_rgba(204,255,0,0.5)] z-30" />
                  <div className="relative mb-3 sm:mb-4 w-24 h-24 sm:w-32 sm:h-32 md:w-36 md:h-36 flex items-center justify-center transition-transform hover:scale-105">
                    <div className="w-[70%] h-[70%] rounded-full bg-[#ccff00] overflow-hidden flex items-center justify-center text-black font-bold text-xl sm:text-3xl uppercase shadow-[0_0_30px_rgba(204,255,0,0.3)] z-10 border-2 border-[#ccff00]">
                      {players[0].avatar_url ? (
                        <img src={players[0].avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        players[0].display_name?.charAt(0)
                      )}
                    </div>
                    {players[0].border_url && (
                      <img src={players[0].border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20 drop-shadow-[0_0_15px_rgba(204,255,0,0.2)]" />
                    )}
                    <div className="absolute -bottom-2 -right-2 bg-[#ccff00] text-black w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-sm sm:text-lg z-30 shadow-[0_0_15px_rgba(204,255,0,0.4)] border-2 border-[#0f1014]">#1</div>
                  </div>
                  <div className="bg-gradient-to-t from-[#1a2210]/90 to-[#0f1014]/90 backdrop-blur-md w-full rounded-t-2xl border-t border-x border-[#ccff00]/40 p-3 sm:p-5 text-center pb-10 sm:pb-12 relative overflow-hidden shadow-[0_-10px_30px_rgba(204,255,0,0.1)] group-hover:border-[#ccff00] transition-colors">
                    <div className="absolute inset-0 bg-[#ccff00]/5 pointer-events-none" />
                    <StarIcon weight="fill" className="text-[#ccff00] w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-1 sm:mb-2 relative z-10 drop-shadow-md" />
                    
                    <div className="flex items-center justify-center gap-1 mb-1 relative z-10">
                      <p className="text-xs sm:text-base font-black truncate text-white">{players[0].display_name}</p>
                      {/* 🔧 BADGE 1ST */}
                      {(() => {
                        const b = getPlayerBadge(players[0].points, allBadges);
                        return b ? <img src={b.image_url} alt={b.name} title={b.name} className="w-4 h-4 sm:w-5 sm:h-5 object-contain" /> : null;
                      })()}
                    </div>

                    {activeTab === 'global' && <p className="text-[8px] sm:text-[10px] text-[#ccff00]/80 uppercase font-bold tracking-widest relative z-10 mt-0.5">{players[0].age_category}</p>}
                    <p className="text-[11px] sm:text-sm text-[#ccff00] font-black relative z-10 mt-1 sm:mt-2">{players[0].points} PTS</p>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {players[2] ? (
                <div 
                  onClick={() => navigate(`/player/${players[2].id}`)}
                  className="flex flex-col items-center group cursor-pointer"
                >
                  <div className="relative mb-3 sm:mb-4 w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 flex items-center justify-center transition-transform hover:scale-105">
                    <div className="w-[70%] h-[70%] rounded-full bg-[#1c1512] overflow-hidden flex items-center justify-center text-[#cd7f32] font-bold text-lg sm:text-xl uppercase shadow-lg z-10 border border-white/10">
                      {players[2].avatar_url ? (
                        <img src={players[2].avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        players[2].display_name?.charAt(0)
                      )}
                    </div>
                    {players[2].border_url && (
                      <img src={players[2].border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20 drop-shadow-md" />
                    )}
                    <div className="absolute -bottom-2 -right-2 bg-[#0f1014] border border-[#cd7f32] text-[#cd7f32] w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm z-30 shadow-lg">#3</div>
                  </div>
                  <div className="bg-gradient-to-t from-[#1c1512]/90 to-[#0f1014]/90 backdrop-blur-md w-full rounded-t-2xl border-t border-x border-[#cd7f32]/30 p-2 sm:p-4 text-center pb-6 sm:pb-8 relative shadow-[0_-10px_20px_rgba(205,127,50,0.05)] group-hover:border-[#cd7f32] transition-colors">
                    <MedalIcon weight="fill" className="text-[#cd7f32] w-5 h-5 sm:w-7 sm:h-7 mx-auto mb-1 sm:mb-2" />
                    
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <p className="text-[10px] sm:text-sm font-bold truncate text-gray-200 group-hover:text-white transition-colors">{players[2].display_name}</p>
                      {/* 🔧 BADGE 3RD */}
                      {(() => {
                        const b = getPlayerBadge(players[2].points, allBadges);
                        return b ? <img src={b.image_url} alt={b.name} title={b.name} className="w-3.5 h-3.5 sm:w-4 sm:h-4 object-contain" /> : null;
                      })()}
                    </div>

                    {activeTab === 'global' && <p className="text-[7px] sm:text-[9px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">{players[2].age_category}</p>}
                    <p className="text-[10px] sm:text-xs text-[#cd7f32] font-black mt-1 sm:mt-2">{players[2].points} PTS</p>
                  </div>
                </div>
              ) : <div />}
            </div>

            <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden relative z-10">
              <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b border-white/5 bg-black/20 text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span>Rank</span>
                <span className="flex-1 ml-2 sm:ml-4">Player</span>
                <span className="capitalize">{activeTab === 'global' ? 'Total' : activeTab} PTS</span>
              </div>
              
              <div className="divide-y divide-white/5">
                {players.slice(3).map((player, idx) => {
                  const rank = idx + 4
                  const isMe = player.id === profile?.id
                  
                  // 🔧 Get badge for row
                  const rowBadge = getPlayerBadge(player.points, allBadges)

                  return (
                    <div 
                      key={player.id} 
                      onClick={() => navigate(`/player/${player.id}`)}
                      className={`flex items-center p-3 sm:p-4 md:p-6 transition cursor-pointer group ${isMe ? 'bg-[#ccff00]/10' : 'hover:bg-white/5'}`}
                    >
                      <span className={`w-6 sm:w-8 md:w-12 font-mono font-bold text-xs sm:text-sm md:text-base ${isMe ? 'text-[#ccff00]' : 'text-gray-500'}`}>
                        #{rank}
                      </span>
                      <div className="flex-1 ml-1 sm:ml-2 md:ml-4 flex items-center gap-2 sm:gap-3 md:gap-4 overflow-hidden">
                        
                        <div className="relative w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 flex-shrink-0 flex items-center justify-center">
                          <div className={`absolute inset-[15%] rounded-full flex items-center justify-center font-bold uppercase overflow-hidden z-10 ${isMe ? 'bg-[#ccff00] text-black' : 'bg-white/10 text-white'}`}>
                            {player.avatar_url ? (
                              <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              player.display_name?.charAt(0)
                            )}
                          </div>
                          {player.border_url && (
                            <img src={player.border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20 scale-100" />
                          )}
                        </div>

                        <div className="truncate flex items-center gap-1.5">
                          <span className={`font-bold text-xs sm:text-sm md:text-base truncate group-hover:text-[#ccff00] transition-colors ${isMe ? 'text-[#ccff00]' : 'text-white'}`}>
                            {player.display_name} {isMe && '(You)'}
                          </span>
                          {/* 🔧 ROW BADGE */}
                          {rowBadge && (
                            <img src={rowBadge.image_url} alt={rowBadge.name} title={rowBadge.name} className="w-4 h-4 object-contain" />
                          )}
                          
                          {activeTab === 'global' && (
                            <span className="text-[8px] sm:text-[9px] uppercase font-bold text-gray-500 ml-1">{player.age_category}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
                        <span className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1 sm:gap-1.5 bg-white/5 px-1.5 sm:px-2.5 py-1 rounded-lg border border-white/10">
                          <TimerIcon size={12} className={`sm:w-[14px] sm:h-[14px] ${formatTime(player.bestTime) ? "text-[#ccff00]" : "text-gray-600"}`} /> 
                          {formatTime(player.bestTime) || '-'}
                        </span>
                        
                        <span className="font-bold text-xs sm:text-sm md:text-base flex items-center gap-0.5 sm:gap-1">
                          <LightningIcon weight="fill" className="text-[#ccff00] w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          {player.points}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {currentUserRank > 3 && (
              <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-72 lg:right-12 bg-[#ccff00] text-black p-3 sm:p-4 rounded-2xl shadow-[0_10px_30px_rgba(204,255,0,0.3)] flex items-center justify-between z-40">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="font-bold font-mono text-sm sm:text-lg">#{currentUserRank}</span>
                  
                  <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center">
                    <div className="absolute inset-[15%] rounded-full bg-black flex items-center justify-center text-[#ccff00] font-bold uppercase overflow-hidden z-10 text-xs sm:text-base">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        profile?.display_name?.charAt(0)
                      )}
                    </div>
                    {players[currentUserRank - 1]?.border_url && (
                      <img src={players[currentUserRank - 1].border_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20 scale-100" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 truncate max-w-[100px] sm:max-w-none">
                    <span className="font-bold text-xs sm:text-base truncate">{profile?.display_name} (You)</span>
                    {/* 🔧 Sticky Footer Badge */}
                    {(() => {
                      const myBadge = getPlayerBadge(profile?.points || 0, allBadges)
                      return myBadge ? <img src={myBadge.image_url} alt="my-badge" className="w-4 h-4 object-contain" /> : null;
                    })()}
                  </div>
                </div>
                <span className="font-bold flex items-center gap-1 text-xs sm:text-base">
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
        <button onClick={() => navigate('/quizzes')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
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
    </div>
  )
}