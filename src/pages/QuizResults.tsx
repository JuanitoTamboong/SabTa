import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  TrophyIcon,
  LightningIcon,
  TargetIcon,
  ArrowRightIcon,
  HouseIcon,
  GameControllerIcon,
  ShoppingBagIcon,
  UserIcon,
  CheckCircleIcon,
  XCircleIcon,
  StarIcon,
  SignOutIcon,
} from '@phosphor-icons/react'

export default function QuizResults() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // We pass the quiz data through the router state
  const { score, correctCount, totalQuestions, quizId } = location.state || {}

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  
  // Calculated stats
  const accuracy = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0
  const isPerfect = correctCount === totalQuestions && totalQuestions > 0

  useEffect(() => {
    const saveResults = async () => {
      // If someone tries to access this page directly without playing, kick them out
      if (!location.state) {
        navigate('/dashboard')
        return
      }

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return navigate('/')

        // 1. Fetch Profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profileData) setProfile(profileData)

        // 2. Save Quiz Attempt to Database
        setSaving(true)
        const { error: attemptError } = await supabase
          .from('quiz_attempts')
          .insert({
            user_id: user.id,
            quiz_id: quizId,
            score: score,
            accuracy: accuracy,
          })

        if (attemptError) throw attemptError

        // 3. Update User Points
        const { error: pointsError } = await supabase
          .from('profiles')
          .update({ points: (profileData?.points || 0) + score })
          .eq('id', user.id)

        if (pointsError) throw pointsError

      } catch (err) {
        console.error("Failed to save results:", err)
      } finally {
        setSaving(false)
        setLoading(false)
      }
    }

    saveResults()
  }, [navigate, location.state, quizId, score, accuracy])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading || saving) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">
        {saving ? 'SAVING RESULTS...' : 'LOADING...'}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0f1014] flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
        <div className="flex items-center gap-3 mb-8 px-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-10 h-10 bg-[#ccff00] rounded-xl flex items-center justify-center text-black font-bold text-xl">S</div>
          <span className="text-2xl font-bold tracking-tighter">SAB<span className="text-[#ccff00]">TA</span></span>
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
      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative overflow-hidden flex flex-col items-center justify-center min-h-screen">
        
        {/* Background Glows */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-[#ccff00]/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Header Logout for Mobile */}
        <div className="lg:hidden absolute top-6 right-6 z-20">
          <button onClick={handleLogout} className="bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20">
            <SignOutIcon weight="bold" className="w-5 h-5" />
          </button>
        </div>

        <div className="relative z-10 bg-[#0f1014] border border-white/10 rounded-[2rem] p-6 md:p-12 max-w-lg w-full text-center shadow-2xl">
          
          {/* Top Icon */}
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-[#ccff00] to-green-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(204,255,0,0.3)]">
            <TrophyIcon weight="fill" className="w-10 h-10 text-black" />
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-2">
            {isPerfect ? 'Flawless Victory!' : 'Quiz Completed!'}
          </h1>
          <p className="text-gray-400 text-sm md:text-base mb-8">
            {isPerfect ? 'You got every single question right. Amazing!' : 'Great effort! Here is your breakdown.'}
          </p>

          {/* Score Grid */}
          <div className="grid grid-cols-3 gap-2 md:gap-4 mb-8">
            <div className="bg-black/40 border border-white/5 rounded-2xl p-3 md:p-4 flex flex-col items-center justify-center">
              <TargetIcon weight="duotone" className="text-[#00f0ff] w-6 h-6 mb-2" />
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Score</p>
              <p className="text-lg md:text-xl font-bold text-[#00f0ff]">{score}</p>
            </div>
            
            <div className="bg-black/40 border border-white/5 rounded-2xl p-3 md:p-4 flex flex-col items-center justify-center">
              <StarIcon weight="duotone" className="text-[#ff00a0] w-6 h-6 mb-2" />
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Accuracy</p>
              <p className="text-lg md:text-xl font-bold text-[#ff00a0]">{accuracy}%</p>
            </div>

            <div className="bg-black/40 border border-white/5 rounded-2xl p-3 md:p-4 flex flex-col items-center justify-center">
              <CheckCircleIcon weight="duotone" className="text-[#ccff00] w-6 h-6 mb-2" />
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Correct</p>
              <p className="text-lg md:text-xl font-bold text-[#ccff00]">{correctCount}/{totalQuestions}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              onClick={() => navigate('/dashboard')} 
              className="w-full bg-[#ccff00] text-black py-4 rounded-xl font-bold hover:bg-white transition flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(204,255,0,0.2)]"
            >
              Return to Dashboard <ArrowRightIcon weight="bold" />
            </button>
            <button 
              onClick={() => navigate('/play/new')} 
              className="w-full bg-white/5 text-white py-4 rounded-xl font-bold hover:bg-white/10 transition border border-white/5"
            >
              Play Another Quiz
            </button>
          </div>
          
        </div>
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