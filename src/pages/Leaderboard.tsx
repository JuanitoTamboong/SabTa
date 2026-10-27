// src/pages/Leaderboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  TrophyIcon,
  LightningIcon,
  SignOutIcon,
  HouseIcon,
  GameControllerIcon,
  ShoppingBagIcon,
  UserIcon,
  MedalIcon,
  CrownIcon,
  StarIcon,
} from '@phosphor-icons/react'

import sabtaLogo from '../assets/icons/sabta-logo.png'

export default function Leaderboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [players, setPlayers] = useState<any[]>([])
  const [activeDifficulty, setActiveDifficulty] = useState('normal')

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')

      // 1. Get Current User Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      if (profileData) {
        setProfile(profileData)
      }

      if (!profileData?.age_category) {
        setLoading(false)
        return
      }

      // 2. Fetch all Quiz Attempts for this Age Category
      // We fetch the raw attempts first to avoid complex nested query errors
      const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select(`
          score,
          user_id,
          quiz_id
        `)

      if (!error && attempts) {
        // 3. Filter and process the data manually
        const bestScores = new Map()
        
        // We need to fetch all the quizzes to know their difficulty and age_category
        const { data: quizzesData } = await supabase.from('quizzes').select('id, difficulty, age_category')
        const quizMap = new Map(quizzesData?.map(q => [q.id, q]))

        attempts.forEach((attempt: any) => {
          const quizInfo: any = quizMap.get(attempt.quiz_id)
          
          // Only process attempts where the quiz matches the user's age category AND the active difficulty
          if (quizInfo && quizInfo.age_category === profileData.age_category && quizInfo.difficulty === activeDifficulty) {
            
            // If this user isn't in the map yet, or this score is higher than their previous best
            if (!bestScores.has(attempt.user_id) || attempt.score > bestScores.get(attempt.user_id).points) {
              bestScores.set(attempt.user_id, {
                id: attempt.user_id,
                points: attempt.score
              })
            }
          }
        })

        // 4. Fetch the Profiles for the users who made it onto the leaderboard
        const userIds = Array.from(bestScores.keys())
        
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', userIds)

          const profileMap = new Map(profilesData?.map(p => [p.id, p]))

          // Merge the profile data into the scores
          const finalLeaderboard = Array.from(bestScores.values()).map(score => {
            const pInfo: any = profileMap.get(score.id)
            return {
              ...score,
              display_name: pInfo?.display_name || 'Unknown Player',
              avatar_url: pInfo?.avatar_url
            }
          })

          // Sort descending
          finalLeaderboard.sort((a, b) => b.points - a.points)
          setPlayers(finalLeaderboard)
        } else {
          setPlayers([])
        }
      }

      setLoading(false)
    }

    fetchLeaderboard()
  }, [navigate, activeDifficulty])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">
        LOADING RANKINGS...
      </div>
    )
  }

  // Find the current user's rank (if they are on the leaderboard)
  const currentUserRank = players.findIndex(p => p.id === profile?.id) + 1

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0f1014] flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
        <div className="flex items-center gap-3 mb-8 px-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
             <img src={sabtaLogo} alt="SabTa" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tighter">SAB<span className="text-[#ccff00]">TA</span></span>
        </div>
        <nav className="flex flex-col w-full gap-2">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <HouseIcon weight="fill" className="w-6 h-6" /> Home
          </button>
          <button onClick={() => navigate('/play/new')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz
          </button>
          <button className="flex items-center gap-4 w-full p-3 rounded-xl bg-[#ccff00]/10 text-[#ccff00] font-bold transition">
            <TrophyIcon weight="fill" className="w-6 h-6" /> Leaderboard
          </button>
          <button onClick={() => navigate('/rewards')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <ShoppingBagIcon weight="fill" className="w-6 h-6" /> Rewards Shop
          </button>
          <button onClick={() => navigate('/profile')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <UserIcon weight="fill" className="w-6 h-6" /> My Profile
          </button>
        </nav>
        <div className="mt-auto w-full">
          <button onClick={handleLogout} className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition">
            <SignOutIcon weight="fill" className="w-6 h-6" /> Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#ccff00]/5 rounded-full blur-[100px] pointer-events-none" />

        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 relative z-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">Global Rankings</h1>
            <p className="text-gray-400 text-xs md:text-sm">
              You are viewing the <span className="text-[#ccff00] font-bold uppercase">{profile?.age_category}</span> tier leaderboard.
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

        {/* DIFFICULTY TABS */}
        <div className="flex gap-2 mb-8 relative z-10">
          {['normal', 'intermediate', 'hard'].map(diff => (
            <button
              key={diff}
              onClick={() => setActiveDifficulty(diff)}
              className={`flex-1 md:flex-none px-6 py-3 rounded-xl font-bold text-sm capitalize transition-all ${
                activeDifficulty === diff 
                  ? 'bg-[#ccff00] text-black shadow-[0_0_20px_rgba(204,255,0,0.3)]' 
                  : 'bg-[#0f1014] text-gray-400 border border-white/5 hover:border-white/20'
              }`}
            >
              {diff}
            </button>
          ))}
        </div>

        {/* PODIUM (Top 3) */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-12 relative z-10 items-end">
          {/* 2nd Place */}
          {players[1] && (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gray-300 border-4 border-[#0f1014] flex items-center justify-center text-black font-bold text-xl uppercase shadow-lg mb-2 overflow-hidden">
                {players[1].avatar_url ? (
                  <img src={players[1].avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  players[1].display_name?.charAt(0)
                )}
              </div>
              <div className="bg-[#0f1014] w-full rounded-t-xl border border-white/10 p-2 md:p-4 text-center pb-6 md:pb-8">
                <MedalIcon weight="fill" className="text-gray-300 w-6 h-6 mx-auto mb-1" />
                <p className="text-xs md:text-sm font-bold truncate">{players[1].display_name}</p>
                <p className="text-[10px] md:text-xs text-gray-400">{players[1].points} PTS</p>
              </div>
            </div>
          )}

          {/* 1st Place */}
          {players[0] && (
            <div className="flex flex-col items-center">
              <CrownIcon weight="fill" className="text-[#ccff00] w-8 h-8 mb-1 animate-bounce" />
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#ccff00] border-4 border-[#0f1014] flex items-center justify-center text-black font-bold text-2xl uppercase shadow-[0_0_30px_rgba(204,255,0,0.4)] mb-2 z-10 overflow-hidden">
                {players[0].avatar_url ? (
                  <img src={players[0].avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  players[0].display_name?.charAt(0)
                )}
              </div>
              <div className="bg-[#141a10] w-full rounded-t-xl border border-[#ccff00]/30 p-2 md:p-4 text-center pb-8 md:pb-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#ccff00]/10 to-transparent" />
                <StarIcon weight="fill" className="text-[#ccff00] w-6 h-6 mx-auto mb-1 relative z-10" />
                <p className="text-sm md:text-base font-bold truncate relative z-10">{players[0].display_name}</p>
                <p className="text-xs md:text-sm text-[#ccff00] font-bold relative z-10">{players[0].points} PTS</p>
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {players[2] && (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-[#cd7f32] border-4 border-[#0f1014] flex items-center justify-center text-black font-bold text-xl uppercase shadow-lg mb-2 overflow-hidden">
                {players[2].avatar_url ? (
                  <img src={players[2].avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  players[2].display_name?.charAt(0)
                )}
              </div>
              <div className="bg-[#0f1014] w-full rounded-t-xl border border-white/10 p-2 md:p-4 text-center pb-6 md:pb-8">
                <MedalIcon weight="fill" className="text-[#cd7f32] w-6 h-6 mx-auto mb-1" />
                <p className="text-xs md:text-sm font-bold truncate">{players[2].display_name}</p>
                <p className="text-[10px] md:text-xs text-gray-400">{players[2].points} PTS</p>
              </div>
            </div>
          )}
        </div>

        {/* REST OF THE LIST */}
        <div className="bg-[#0f1014] border border-white/10 rounded-3xl overflow-hidden relative z-10">
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5 bg-black/20 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>Rank</span>
            <span className="flex-1 ml-4">Player</span>
            <span>Points</span>
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
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold uppercase overflow-hidden ${isMe ? 'bg-[#ccff00] text-black' : 'bg-white/10 text-white'}`}>
                      {player.avatar_url ? (
                        <img src={player.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        player.display_name?.charAt(0)
                      )}
                    </div>
                    <span className={`font-bold text-sm md:text-base truncate ${isMe ? 'text-[#ccff00]' : 'text-white'}`}>
                      {player.display_name} {isMe && '(You)'}
                    </span>
                  </div>
                  <span className="font-bold text-sm md:text-base flex items-center gap-1">
                    <LightningIcon weight="fill" className="text-[#ccff00] w-4 h-4" />
                    {player.points}
                  </span>
                </div>
              )
            })}

            {players.length === 0 && (
              <div className="p-12 text-center">
                <TrophyIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 font-bold mb-1">No players yet</p>
                <p className="text-gray-500 text-sm">Be the first to play a {activeDifficulty} quiz in this tier!</p>
              </div>
            )}
          </div>
        </div>

        {/* STICKY USER RANK (If outside top 3) */}
        {currentUserRank > 3 && (
          <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-72 lg:right-12 bg-[#ccff00] text-black p-4 rounded-2xl shadow-[0_10px_30px_rgba(204,255,0,0.3)] flex items-center justify-between z-40">
            <div className="flex items-center gap-3">
              <span className="font-bold font-mono text-lg">#{currentUserRank}</span>
              <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-[#ccff00] font-bold uppercase overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  profile?.display_name?.charAt(0)
                )}
              </div>
              <span className="font-bold">{profile?.display_name} (You)</span>
            </div>
            <span className="font-bold flex items-center gap-1">
              <LightningIcon weight="fill" /> {players[currentUserRank - 1]?.points || 0}
            </span>
          </div>
        )}

      </main>

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <HouseIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Home</span>
        </button>
        <button onClick={() => navigate('/play/new')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
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