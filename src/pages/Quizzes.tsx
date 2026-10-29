// src/pages/Quizzes.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TrophyIcon, ArrowLeftIcon, CoinsIcon, GameControllerIcon, SparkleIcon } from '@phosphor-icons/react'

export default function Quizzes() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([])

  useEffect(() => {
    const fetchQuizzes = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')

      // Fetch user profile
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      setProfile(profileData)

      if (!profileData?.age_category) {
        setLoading(false)
        return
      }

      // Fetch completed quizzes
      const { data: completed } = await supabase
        .from('quiz_attempts')
        .select('quiz_id')
        .eq('user_id', user.id)
        .eq('status', 'completed') 
        
      const completedIds = completed?.map(c => c.quiz_id) || []

      // Fetch available quizzes
      let query = supabase
        .from('quizzes')
        .select('id, title, category, difficulty, created_at, questions(count)')
        .eq('age_category', profileData.age_category)
        .eq('status', 'published')

      if (completedIds.length > 0) {
        query = query.not('id', 'in', `(${completedIds.join(',')})`)
      }

      const { data: quizzes } = await query
      setAvailableQuizzes((quizzes || []).filter(q => (q.questions as any)?.[0]?.count > 0))
      setLoading(false)
    }

    fetchQuizzes()
  }, [navigate])

  // ✅ Helper to determine if a quiz was created today
  const isNewQuiz = (createdAt: string) => {
    if (!createdAt) return false
    const quizDate = new Date(createdAt).toDateString()
    const today = new Date().toDateString()
    return quizDate === today
  }

  if (loading) {
    return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">LOADING QUIZZES...</div>
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col p-4 sm:p-8 lg:p-12 pb-24">
      <div className="max-w-3xl w-full mx-auto pt-4 sm:pt-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <button onClick={() => navigate('/dashboard')} className="bg-white/5 hover:bg-white/10 p-3 rounded-xl transition shrink-0">
              <ArrowLeftIcon weight="bold" className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Choose a Challenge</h1>
              <p className="text-gray-400 text-xs sm:text-sm mt-0.5">Select a quiz to play & earn coins.</p>
            </div>
          </div>
          
          <div className="sm:ml-auto bg-[#ff00a0]/10 border border-[#ff00a0]/20 px-4 py-2.5 rounded-xl flex items-center justify-center sm:justify-start gap-2 w-full sm:w-auto">
            <CoinsIcon weight="fill" className="text-[#ff00a0] w-5 h-5" />
            <span className="font-bold text-[#ff00a0] text-sm">{profile?.coins || 0} COINS</span>
          </div>
        </div>

        {/* Quiz List */}
        <div className="space-y-3 sm:space-y-4">
          {availableQuizzes.length === 0 ? (
            <div className="text-center py-16 bg-[#0f1014] border border-white/10 rounded-3xl">
              <TrophyIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-bold text-lg">All caught up!</p>
              <p className="text-gray-500 text-sm mt-1">You've completed all available quizzes for your tier.</p>
            </div>
          ) : (
            availableQuizzes.map((q) => (
              <button 
                key={q.id} 
                onClick={() => navigate(`/play/${q.id}`)} 
                className="w-full text-left bg-[#0f1014] border border-white/10 rounded-2xl p-4 sm:p-5 hover:border-[#ccff00]/50 hover:bg-[#ccff00]/5 transition group flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg relative overflow-hidden"
              >
                {/* ❌ REMOVED: The glowing left border */}

                <div className="w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-sm sm:text-base text-white group-hover:text-[#ccff00] transition leading-tight break-words">
                      {q.title}
                    </p>
                    {/* ✅ KEPT: The New Badge */}
                    {isNewQuiz(q.created_at) && (
                      <span className="bg-[#00f0ff]/20 text-[#00f0ff] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border border-[#00f0ff]/30 flex items-center gap-1 shrink-0">
                        <SparkleIcon weight="fill" className="w-3 h-3" /> New
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-gray-400 flex items-center gap-1.5">
                    <GameControllerIcon weight="fill" className="w-3.5 h-3.5" />
                    {q.category}
                  </p>
                </div>
                
                <div className="flex items-center w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                  <span className={`text-[10px] sm:text-xs font-bold uppercase px-2.5 py-1.5 rounded-lg border ${
                    q.difficulty === 'hard' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                    q.difficulty === 'intermediate' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 
                    'bg-green-500/10 text-green-400 border-green-500/20'
                  }`}>
                    {q.difficulty}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}