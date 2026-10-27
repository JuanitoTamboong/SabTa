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
} from '@phosphor-icons/react'

import sabtaLogo from '../assets/icons/sabta-logo.png' 

export default function UserDashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    bestScore: 0,
    accuracy: 0,
    level: 1,
    quizzesToday: 0
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
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')

      if (user.user_metadata?.avatar_url || user.user_metadata?.picture) {
        setAvatarUrl(user.user_metadata.avatar_url || user.user_metadata.picture)
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileData) {
        setProfile(profileData)
      }

      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('*, quizzes(title)')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })

      if (attempts) {
        const totalQuizzes = attempts.length
        const bestScore = totalQuizzes > 0 ? Math.max(...attempts.map(a => a.score)) : 0
        const avgAccuracy = totalQuizzes > 0 
          ? attempts.reduce((acc, curr) => acc + (curr.accuracy || 0), 0) / totalQuizzes 
          : 0
        
        const currentPoints = profileData?.points || 0
        const level = Math.floor(currentPoints / 100) + 1

        const today = new Date().toISOString().split('T')[0]
        const quizzesToday = attempts.filter(a => a.completed_at.startsWith(today)).length

        setStats({
          totalQuizzes,
          bestScore,
          accuracy: Math.round(avgAccuracy),
          level,
          quizzesToday
        })

        setRecentActivity(attempts.slice(0, 3))
      }

      if (profileData?.age_category) {
        const { data: topProfiles } = await supabase
          .from('profiles')
          .select('display_name, points')
          .eq('age_category', profileData.age_category)
          .order('points', { ascending: false })
          .limit(3)
        
        if (topProfiles) setTopPlayers(topProfiles)
      }

      setLoading(false)
    }

    fetchData()
  }, [navigate])

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
    <div className="min-h-screen bg-[#050505] text-white flex">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0f1014] flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
        <div className="flex items-center gap-3 mb-8 px-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
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
          <button onClick={() => navigate('/play/new')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz
          </button>
          <button onClick={() => navigate('/leaderboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
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

      {/* MAIN CONTENT AREA - Reduced padding on mobile */}
      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none" />
        
        {/* HEADER - Tighter layout */}
        <header className="flex justify-between items-center mb-6 relative z-10">
          <div>
            <h1 className="text-xl md:text-3xl font-bold mb-1 leading-tight">
              {getGreeting()}, <br className="md:hidden" />
              <span className="text-[#ccff00]">{profile?.display_name?.split(' ')[0] || 'Player'}</span>!
            </h1>
            <p className="text-gray-400 text-xs flex items-center gap-2 mt-1">
              <FireIcon weight="fill" className="text-[#ff00a0]" /> 
              Level {stats.level} • {profile?.age_category?.toUpperCase()} Tier
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="bg-[#0f1014] border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <LightningIcon weight="fill" className="text-[#ccff00] w-4 h-4" />
              <span className="font-bold text-xs">{profile?.points || 0} PTS</span>
            </div>
            
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#00f0ff] to-blue-600 border-2 border-white/20 flex items-center justify-center font-bold text-black uppercase overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                profile?.display_name?.charAt(0) || 'P'
              )}
            </div>
            
            {/* MOBILE LOGOUT */}
            <button onClick={handleLogout} className="md:hidden bg-red-500/10 text-red-400 p-2 rounded-xl border border-red-500/20">
              <SignOutIcon weight="bold" className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* STATS GRID - More compact */}
        <div className="grid grid-cols-2 gap-3 mb-6 relative z-10">
          <div className="bg-[#0f1014] border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <GameControllerIcon weight="duotone" className="text-[#00f0ff] w-5 h-5" />
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Played</p>
            </div>
            <p className="text-2xl font-bold">{stats.totalQuizzes}</p>
          </div>

          <div className="bg-[#0f1014] border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <TrophyIcon weight="duotone" className="text-[#ff00a0] w-5 h-5" />
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Best Score</p>
            </div>
            <p className="text-2xl font-bold">{stats.bestScore} <span className="text-xs text-gray-500">pts</span></p>
          </div>

          <div className="bg-[#0f1014] border border-white/10 p-4 rounded-2xl flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-1">
              <TargetIcon weight="duotone" className="text-[#ccff00] w-5 h-5" />
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Accuracy</p>
            </div>
            <p className="text-2xl font-bold">{stats.accuracy}%</p>
          </div>

          <div className="bg-[#0f1014] border border-white/10 p-4 rounded-2xl flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-12 h-12 bg-[#ccff00]/10 rounded-bl-full" />
            <div className="flex items-center gap-2 mb-1 relative z-10">
              <MedalIcon weight="duotone" className="text-[#00f0ff] w-5 h-5" />
              <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Level</p>
            </div>
            <p className="text-2xl font-bold relative z-10">{stats.level}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 relative z-10">
          
          {/* QUICK PLAY BANNER - Fixed cutoff */}
          <div className="relative bg-gradient-to-r from-[#111] to-[#1a1a1a] border border-white/10 p-5 rounded-3xl overflow-hidden group cursor-pointer" onClick={() => navigate('/play/new')}>
            <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-[#ccff00]/20 rounded-full blur-2xl group-hover:bg-[#ccff00]/40 transition-all duration-500" />
            <div className="relative z-10 flex flex-col items-start">
              <div className="bg-[#ccff00]/20 text-[#ccff00] px-3 py-1 rounded-full text-[10px] font-bold mb-3 uppercase tracking-wider">
                {profile?.age_category || 'General'} Tier
              </div>
              <h2 className="text-lg font-bold mb-1">Ready to test your knowledge?</h2>
              <p className="text-gray-400 text-xs mb-4 max-w-[250px]">Jump straight into a quick quiz and earn points to unlock new themes.</p>
              <button className="bg-[#ccff00] text-black px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)] text-sm">
                Play Now <CaretRightIcon weight="bold" />
              </button>
            </div>
          </div>

          {/* RECENT ACTIVITY - More compact */}
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-bold">Recent Activity</h3>
              <ClockIcon className="text-gray-500 w-4 h-4" />
            </div>
            
            {recentActivity.length === 0 ? (
              <div className="text-gray-500 text-xs text-center py-6 bg-black/20 rounded-2xl border border-white/5">
                No recent quizzes played.
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.map((attempt) => (
                  <div key={attempt.id} className="flex items-center justify-between p-3 bg-black/40 border border-white/5 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                        <CheckCircleIcon weight="fill" className="text-[#ccff00] w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-xs">{attempt.quizzes?.title || 'General Quiz'}</p>
                        <p className="text-[10px] text-gray-500">
                          {new Date(attempt.completed_at).toLocaleDateString()} • {attempt.accuracy}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#ccff00] text-xs">+{attempt.score}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DAILY CHALLENGE */}
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-[#ff00a0]/10 rounded-bl-full" />
            <div className="flex justify-between items-center mb-3 relative z-10">
              <h3 className="text-sm font-bold">Daily Challenge</h3>
              <TargetIcon className="text-[#ff00a0] w-5 h-5" />
            </div>
            <p className="text-xs text-gray-400 mb-3 relative z-10">Complete 3 quizzes today for +50 PTS.</p>
            
            <div className="w-full bg-white/5 rounded-full h-1.5 mb-1.5 relative z-10">
              <div 
                className="bg-[#ff00a0] h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((stats.quizzesToday / 3) * 100, 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-right text-gray-400 font-bold relative z-10">
              {stats.quizzesToday} / 3 Completed
            </p>
          </div>

          {/* LEADERBOARD SNIPPET */}
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold">Top {profile?.age_category || 'Players'}</h3>
              <MedalIcon weight="fill" className="text-[#ccff00] w-4 h-4" />
            </div>
            
            <div className="space-y-3">
              {topPlayers.length === 0 ? (
                 <div className="text-gray-500 text-xs text-center py-2">No players yet.</div>
              ) : (
                topPlayers.map((player, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-4 ${
                      idx === 0 ? 'text-[#ccff00]' : idx === 1 ? 'text-gray-300' : 'text-[#cd7f32]'
                    }`}>
                      #{idx + 1}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold uppercase">
                      {player.display_name?.charAt(0) || 'P'}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold truncate">{player.display_name}</p>
                    </div>
                    <span className="text-[10px] font-bold text-[#ccff00]">{player.points} pts</span>
                  </div>
                ))
              )}
            </div>
            
            <button onClick={() => navigate('/leaderboard')} className="w-full mt-4 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs font-bold transition">
              View Leaderboard
            </button>
          </div>

        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button className="flex flex-col items-center gap-1 text-[#ccff00]">
          <HouseIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Home</span>
        </button>
        <button onClick={() => navigate('/play/new')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <GameControllerIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Play</span>
        </button>
        <button onClick={() => navigate('/leaderboard')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
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