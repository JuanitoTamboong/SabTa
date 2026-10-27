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

        setStats({
          totalQuizzes,
          bestScore,
          accuracy: Math.round(avgAccuracy),
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
      
      {/* DESKTOP SIDEBAR (Hidden on Mobile) */}
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

      {/* MAIN CONTENT AREA (Margin removed on Mobile) */}
      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none" />

        <header className="mb-6 md:mb-10 relative z-10 flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">My Profile</h1>
            <p className="text-gray-400 text-xs md:text-sm">Manage your account settings and view your history.</p>
          </div>
          
          {/* MOBILE LOGOUT BUTTON */}
          <button onClick={handleLogout} className="md:hidden bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20">
            <SignOutIcon weight="bold" className="w-5 h-5" />
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 relative z-10">
          
          <div className="space-y-6 md:space-y-8">
            <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 md:h-32 bg-gradient-to-b from-[#00f0ff]/10 to-transparent" />
              
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-[#0f1014] bg-white/10 flex items-center justify-center text-2xl md:text-3xl font-bold uppercase overflow-hidden relative z-10 shadow-xl mb-4">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  profile?.display_name?.charAt(0) || 'P'
                )}
              </div>

              {isEditing ? (
                <div className="w-full relative z-10">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-center text-base md:text-lg font-bold focus:outline-none focus:border-[#ccff00] mb-3"
                    maxLength={20}
                  />
                  <div className="flex gap-2 justify-center">
                    <button onClick={handleUpdateName} disabled={saving} className="bg-[#ccff00] text-black p-2 rounded-lg hover:bg-white transition">
                      <FloppyDiskIcon weight="bold" className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsEditing(false)} disabled={saving} className="bg-white/10 text-white p-2 rounded-lg hover:bg-white/20 transition">
                      <XIcon weight="bold" className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative z-10 flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
                  <h2 className="text-xl md:text-2xl font-bold">{profile?.display_name || 'Player'}</h2>
                  <PencilSimpleIcon weight="bold" className="w-4 h-4 text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}

              <p className="text-[#ccff00] font-mono text-xs md:text-sm mt-1 mb-6 relative z-10 bg-[#ccff00]/10 px-3 py-1 rounded-full">
                {profile?.age_category?.toUpperCase() || 'UNASSIGNED'} TIER
              </p>

              <div className="w-full space-y-2 md:space-y-3 relative z-10">
                <div className="flex justify-between items-center text-xs md:text-sm p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-gray-400">Total Points</span>
                  <span className="font-bold flex items-center gap-1 text-[#ccff00]"><LightningIcon weight="fill"/> {profile?.points || 0}</span>
                </div>
                <div className="flex justify-between items-center text-xs md:text-sm p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-gray-400">Account Role</span>
                  <span className="font-bold capitalize">{profile?.role || 'Player'}</span>
                </div>
                <div className="flex justify-between items-center text-xs md:text-sm p-3 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-gray-400">Joined</span>
                  <span className="font-bold">{new Date(profile?.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6">
              <h3 className="text-base md:text-lg font-bold mb-4">Lifetime Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#00f0ff]/10 flex items-center justify-center text-[#00f0ff]">
                    <GameControllerIcon weight="duotone" className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-400">Quizzes Played</p>
                    <p className="text-lg md:text-xl font-bold">{stats.totalQuizzes}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#ff00a0]/10 flex items-center justify-center text-[#ff00a0]">
                    <TrophyIcon weight="duotone" className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-400">Best Score</p>
                    <p className="text-lg md:text-xl font-bold">{stats.bestScore} <span className="text-xs text-gray-500">pts</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#ccff00]/10 flex items-center justify-center text-[#ccff00]">
                    <TargetIcon weight="duotone" className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-gray-400">Average Accuracy</p>
                    <p className="text-lg md:text-xl font-bold">{stats.accuracy}%</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-4 md:p-8">
              <div className="flex justify-between items-center mb-4 md:mb-6">
                <h3 className="text-lg md:text-xl font-bold">Quiz History</h3>
                <CalendarBlankIcon className="text-gray-500 w-5 h-5 md:w-6 md:h-6" />
              </div>

              {history.length === 0 ? (
                <div className="text-center py-12 md:py-16 bg-black/20 rounded-2xl border border-white/5">
                  <GameControllerIcon weight="duotone" className="w-12 h-12 md:w-16 md:h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold mb-1 text-sm md:text-base">No quizzes played yet</p>
                  <p className="text-gray-500 text-xs md:text-sm mb-6">Your history will appear here.</p>
                  <button onClick={() => navigate('/play/new')} className="bg-[#ccff00] text-black px-6 py-2 rounded-xl font-bold hover:bg-white transition text-sm">
                    Play your first quiz
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((attempt) => (
                    <div key={attempt.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl gap-3 md:gap-4 hover:border-white/20 transition">
                      
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center ${
                          attempt.accuracy >= 80 ? 'bg-green-500/10 text-green-400' :
                          attempt.accuracy >= 50 ? 'bg-yellow-500/10 text-yellow-400' :
                          'bg-red-500/10 text-red-400'
                        }`}>
                          <CheckCircleIcon weight="fill" className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                          <p className="font-bold text-sm md:text-base">Quiz Completed</p>
                          <div className="flex gap-2 text-[10px] md:text-xs text-gray-500 font-mono mt-1">
                            <span className="text-[#00f0ff] uppercase">Points: {attempt.score}</span>
                            <span>•</span>
                            <span className="uppercase">Accuracy: {attempt.accuracy}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 md:gap-8 justify-between md:justify-end">
                        <div className="text-center">
                          <p className="text-[9px] md:text-[10px] text-gray-500 uppercase font-bold">Date</p>
                          <p className="font-bold text-[10px] md:text-xs">{new Date(attempt.created_at).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right bg-white/5 px-3 md:px-4 py-2 rounded-xl border border-white/5">
                          <p className="text-[9px] md:text-[10px] text-gray-500 uppercase font-bold">Score</p>
                          <p className="font-bold text-[#ccff00] text-xs md:text-base">+{attempt.score} PTS</p>
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