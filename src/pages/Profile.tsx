// src/pages/Profile.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  UserIcon,
  SignOutIcon,
  HouseIcon,
  GameControllerIcon,
  TrophyIcon,
  ShoppingBagIcon,
  LightningIcon,
  CheckCircleIcon,
  PencilSimpleIcon,
  FloppyDiskIcon,
  XIcon,
  CalendarBlankIcon,
  TargetIcon,
  CoinsIcon,
  MedalIcon,
  StarIcon,
} from '@phosphor-icons/react'

import sabtaLogo from '../assets/icons/sabta-logo.png'

export default function Profile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')

  // History State
  const [history, setHistory] = useState<any[]>([])
  
  // Stats State
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    bestScore: 0,
    accuracy: 0,
    totalCoinsEarned: 0,
  })

  useEffect(() => {
    const fetchProfileData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')

      // 1. Get Avatar from Google
      if (user.user_metadata?.avatar_url || user.user_metadata?.picture) {
        setAvatarUrl(user.user_metadata.avatar_url || user.user_metadata.picture)
      }

      // 2. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (profileData) {
        setProfile(profileData)
        setEditName(profileData.display_name || '')
      }

      // 3. Fetch History & Stats
      const { data: attempts, error } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (attempts && !error) {
        setHistory(attempts)
        
        const totalQuizzes = attempts.length
        const bestScore = totalQuizzes > 0 ? Math.max(...attempts.map(a => a.score)) : 0
        const avgAccuracy = totalQuizzes > 0 
          ? attempts.reduce((acc, curr) => acc + (curr.accuracy || 0), 0) / totalQuizzes 
          : 0
        const totalCoinsEarned = attempts.reduce((acc, curr) => acc + (curr.correct_answers * 150), 0)

        setStats({
          totalQuizzes,
          bestScore,
          accuracy: Math.round(avgAccuracy),
          totalCoinsEarned,
        })
      }

      setLoading(false)
    }

    fetchProfileData()
  }, [navigate])

  const handleUpdateName = async () => {
    if (!editName.trim() || editName === profile.display_name) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: editName })
        .eq('id', profile.id)

      if (error) throw error
      
      setProfile({ ...profile, display_name: editName })
      setIsEditing(false)
    } catch (err) {
      console.error("Failed to update name", err)
      alert("Failed to update name.")
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">
        LOADING PROFILE...
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
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
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
          <button className="flex items-center gap-4 w-full p-3 rounded-xl bg-[#ccff00]/10 text-[#ccff00] font-bold transition">
            <UserIcon weight="fill" className="w-6 h-6" /> My Profile
          </button>
        </nav>

        <div className="mt-auto w-full">
          <button onClick={handleLogout} className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition">
            <SignOutIcon weight="fill" className="w-6 h-6" /> Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#ff00a0]/5 rounded-full blur-[100px] pointer-events-none" />

        <header className="mb-6 md:mb-10 relative z-10 flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">My Profile</h1>
            <p className="text-gray-400 text-xs md:text-sm">Manage your account settings and view your history.</p>
          </div>
          
          <button onClick={handleLogout} className="md:hidden bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20">
            <SignOutIcon weight="bold" className="w-5 h-5" />
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 relative z-10">
          
          {/* LEFT COLUMN: PROFILE CARD & STATS */}
          <div className="lg:col-span-4 space-y-6 md:space-y-8">
            
            {/* Main Profile Card */}
            <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#00f0ff]/10 to-transparent" />
              
              <div className="relative group cursor-pointer" onClick={() => setIsEditing(true)}>
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full border-4 border-[#0f1014] bg-white/10 flex items-center justify-center text-3xl font-bold uppercase overflow-hidden relative z-10 shadow-[0_0_30px_rgba(0,240,255,0.2)]">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    profile?.display_name?.charAt(0) || 'P'
                  )}
                </div>
                <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-20">
                  <PencilSimpleIcon weight="bold" className="w-8 h-8 text-white" />
                </div>
              </div>

              <div className="mt-5 mb-2 relative z-10 w-full flex flex-col items-center">
                {isEditing ? (
                  <div className="w-full max-w-[200px]">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-center text-lg font-bold focus:outline-none focus:border-[#ccff00] mb-3 text-white"
                      maxLength={20}
                      autoFocus
                    />
                    <div className="flex gap-2 justify-center">
                      <button onClick={handleUpdateName} disabled={saving} className="bg-[#ccff00] text-black px-4 py-2 rounded-lg font-bold hover:bg-white transition flex items-center gap-1">
                        <FloppyDiskIcon weight="bold" /> Save
                      </button>
                      <button onClick={() => setIsEditing(false)} disabled={saving} className="bg-white/10 text-white px-4 py-2 rounded-lg font-bold hover:bg-white/20 transition">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-2">{profile?.display_name || 'Player'}</h2>
                    <span className="text-[#ccff00] font-mono text-xs bg-[#ccff00]/10 px-3 py-1 rounded-full border border-[#ccff00]/20">
                      {profile?.age_category?.toUpperCase() || 'UNASSIGNED'} TIER
                    </span>
                  </>
                )}
              </div>

              {/* Balance & Info */}
              <div className="w-full space-y-3 mt-6 relative z-10">
                
                <div className="flex justify-between items-center p-3.5 bg-black/40 rounded-xl border border-white/5 hover:border-white/10 transition">
                  <span className="text-gray-400 text-sm font-semibold flex items-center gap-2">
                    <MedalIcon weight="fill" className="text-gray-500 w-5 h-5" /> Total Points
                  </span>
                  <span className="font-bold text-[#ccff00] text-lg flex items-center gap-1.5">
                    <LightningIcon weight="fill"/> {profile?.points || 0}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3.5 bg-black/40 rounded-xl border border-[#ff00a0]/20 hover:border-[#ff00a0]/40 transition">
                  <span className="text-gray-400 text-sm font-semibold flex items-center gap-2">
                    <ShoppingBagIcon weight="fill" className="text-[#ff00a0] w-5 h-5" /> Coins Balance
                  </span>
                  <span className="font-bold text-[#ff00a0] text-lg flex items-center gap-1.5">
                    <CoinsIcon weight="fill"/> {profile?.coins || 0}
                  </span>
                </div>

                <div className="flex justify-between items-center p-3.5 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-gray-400 text-sm font-semibold flex items-center gap-2">
                    <CalendarBlankIcon className="text-gray-500 w-5 h-5" /> Joined
                  </span>
                  <span className="font-bold text-sm">{new Date(profile?.created_at).toLocaleDateString()}</span>
                </div>

              </div>
            </div>

            {/* Lifetime Stats */}
            <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#ccff00]/5 rounded-bl-full" />
              <h3 className="text-lg font-bold mb-5 flex items-center gap-2">
                <StarIcon weight="fill" className="text-[#ccff00]" /> Lifetime Stats
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <GameControllerIcon weight="duotone" className="text-[#00f0ff] w-6 h-6 mb-2" />
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Played</p>
                  <p className="text-xl font-bold">{stats.totalQuizzes}</p>
                </div>
                
                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <TargetIcon weight="duotone" className="text-[#ccff00] w-6 h-6 mb-2" />
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Accuracy</p>
                  <p className="text-xl font-bold">{stats.accuracy}%</p>
                </div>

                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <TrophyIcon weight="duotone" className="text-[#ff00a0] w-6 h-6 mb-2" />
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Best Score</p>
                  <p className="text-xl font-bold">{stats.bestScore}</p>
                </div>

                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <CoinsIcon weight="fill" className="text-[#ff00a0] w-6 h-6 mb-2" />
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Coins Earned</p>
                  <p className="text-xl font-bold text-[#ff00a0]">{stats.totalCoinsEarned}</p>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: QUIZ HISTORY */}
          <div className="lg:col-span-8">
            <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-5 md:p-8 h-full">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Recent Quiz History</h3>
                <span className="text-xs font-mono text-gray-500 bg-white/5 px-3 py-1 rounded-lg">Last {history.length} attempts</span>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-20 bg-black/20 rounded-3xl border border-white/5">
                  <GameControllerIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold mb-1">No quizzes played yet</p>
                  <p className="text-gray-500 text-sm mb-6">Your recent activity will appear here.</p>
                  <button onClick={() => navigate('/play/new')} className="bg-[#ccff00] text-black px-6 py-3 rounded-xl font-bold hover:bg-white transition shadow-[0_0_15px_rgba(204,255,0,0.3)]">
                    Play your first quiz
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((attempt) => (
                    <div key={attempt.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl gap-4 hover:border-white/20 hover:bg-black/60 transition-all duration-300">
                      
                      {/* Left Side: Icon & Info */}
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                          attempt.accuracy >= 80 ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                          attempt.accuracy >= 50 ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                          'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          <CheckCircleIcon weight="fill" className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-white text-base">Quiz Completed</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">
                            {new Date(attempt.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>

                      {/* Right Side: Stats Badges */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {/* Accuracy Badge */}
                        <div className="bg-white/5 px-3 py-1.5 rounded-lg border border-white/5 text-center">
                          <p className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Accuracy</p>
                          <p className={`font-bold text-xs ${attempt.accuracy >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                            {attempt.accuracy}%
                          </p>
                        </div>

                        {/* Points Badge */}
                        <div className="bg-[#ccff00]/10 px-3 py-1.5 rounded-lg border border-[#ccff00]/20 text-center min-w-[70px]">
                          <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Points</p>
                          <p className="font-bold text-[#ccff00] text-sm">+{attempt.score}</p>
                        </div>

                        {/* Coins Badge */}
                        <div className="bg-[#ff00a0]/10 px-3 py-1.5 rounded-lg border border-[#ff00a0]/20 text-center min-w-[70px]">
                          <p className="text-[9px] text-gray-400 uppercase font-bold mb-0.5">Coins</p>
                          <p className="font-bold text-[#ff00a0] text-sm">+{attempt.correct_answers * 150}</p>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
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
        <button className="flex flex-col items-center gap-1 text-[#ccff00]">
          <UserIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Profile</span>
        </button>
      </nav>
    </div>
  )
}