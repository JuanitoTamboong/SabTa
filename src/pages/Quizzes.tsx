// src/pages/Quizzes.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TrophyIcon, ArrowLeftIcon, CoinsIcon, GameControllerIcon, SparkleIcon } from '@phosphor-icons/react'
import LoadingScreen from '../components/LoadingScreen'
import '../css/Quizzes.css'

export default function Quizzes() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([])

  useEffect(() => {
    let isActive = true
    let latestRequest = 0
    let channel: ReturnType<typeof supabase.channel> | undefined

    const fetchQuizzes = async (userId: string, ageCategory: string) => {
      const requestId = ++latestRequest
      setLoadError(null)

      const { data: completed, error: completedError } = await supabase
        .from('quiz_attempts')
        .select('quiz_id')
        .eq('user_id', userId)
        .eq('status', 'completed')

      if (!isActive || requestId !== latestRequest) return
      if (completedError) {
        console.error('Failed to load completed quizzes:', completedError)
        setLoadError('Unable to load quizzes right now. Please try again later.')
        setLoading(false)
        return
      }

      const completedIds = completed?.map(c => c.quiz_id) || []

      let query = supabase
        .from('quizzes')
        .select('id, title, category, difficulty, created_at, questions(count)')
        .eq('age_category', ageCategory)
        .eq('status', 'published')

      if (completedIds.length > 0) {
        query = query.not('id', 'in', `(${completedIds.join(',')})`)
      }

      const { data: quizzes, error: quizzesError } = await query

      if (!isActive || requestId !== latestRequest) return
      if (quizzesError) {
        console.error('Failed to load available quizzes:', quizzesError)
        setLoadError('Unable to load quizzes right now. Please try again later.')
        setLoading(false)
        return
      }

      setAvailableQuizzes((quizzes || []).filter(q => (q.questions as any)?.[0]?.count > 0))
      setLoading(false)
    }

    const initialize = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')
      if (!isActive) return

      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      if (!isActive) return
      if (profileError) {
        console.error('Failed to load player profile:', profileError)
        setLoadError('Unable to load quizzes right now. Please try again later.')
        setLoading(false)
        return
      }
      setProfile(profileData)

      if (!profileData?.age_category) {
        setLoading(false)
        return
      }

      channel = supabase
        .channel(`available-quizzes-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'quizzes' },
          () => {
            void fetchQuizzes(user.id, profileData.age_category)
          }
        )
        .subscribe()

      await fetchQuizzes(user.id, profileData.age_category)
    }

    void initialize()

    return () => {
      isActive = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [navigate])

  // ✅ Helper to determine if a quiz was created today
  const isNewQuiz = (createdAt: string) => {
    if (!createdAt) return false
    const quizDate = new Date(createdAt).toDateString()
    const today = new Date().toDateString()
    return quizDate === today
  }

  if (loading) {
    return <LoadingScreen title="Finding your next quiz" subtitle="Loading quizzes for your arena." />
  }

  return (
    <div className="quiz-select-page">
      <div className="quiz-select-ambient" aria-hidden="true" />
      <header className="quiz-select-topbar">
        <button onClick={() => navigate('/dashboard')} className="quiz-select-back" aria-label="Back to dashboard">
          <ArrowLeftIcon weight="bold" />
        </button>
        <span className="quiz-select-breadcrumb"><span>PLAYER HUB</span><i>/</i> QUIZ ARENA</span>
        <div className="quiz-select-wallet">
          <CoinsIcon weight="fill" />
          <strong>{(profile?.coins || 0).toLocaleString()}</strong>
          <small>COINS</small>
        </div>
      </header>

      <main className="quiz-select-content">
        <section className="quiz-select-hero">
          <div className="quiz-select-hero__copy">
            <span className="quiz-select-eyebrow"><GameControllerIcon weight="fill" /> THE QUIZ ARENA</span>
            <h1>Pick your next<br /><span>challenge.</span></h1>
            <p>Test your knowledge, climb your personal best, and earn coins with every run.</p>
            <div className="quiz-select-hero__status">
              <span><i /> {availableQuizzes.length} CHALLENGES READY</span>
              <span className="quiz-select-hero__divider" />
              <span>ONE RUN. ALL FOCUS.</span>
            </div>
          </div>
          <div className="quiz-select-hero__emblem" aria-hidden="true">
            <span className="quiz-select-hero__ring quiz-select-hero__ring--outer" />
            <span className="quiz-select-hero__ring quiz-select-hero__ring--inner" />
            <GameControllerIcon weight="duotone" />
            <span className="quiz-select-hero__emblem-label">READY<br />PLAYER</span>
          </div>
        </section>

        <section className="quiz-select-list">
          <div className="quiz-select-list__heading">
            <div><span>AVAILABLE MISSIONS</span><small>Choose a challenge to begin</small></div>
            <span className="quiz-select-count">{availableQuizzes.length} AVAILABLE</span>
          </div>
          {loadError && (
            <div className="quiz-select-error">
              {loadError}
            </div>
          )}
          {availableQuizzes.length === 0 && loadError ? null : availableQuizzes.length === 0 ? (
            <div className="quiz-select-empty">
              <span><TrophyIcon weight="duotone" /></span>
              <strong>All caught up!</strong>
              <p>You've completed all available quizzes for your tier.</p>
              <button onClick={() => navigate('/dashboard')}>Return to your dashboard <ArrowLeftIcon weight="bold" /></button>
            </div>
          ) : (
            <div className="quiz-select-grid">{availableQuizzes.map((q, index) => (
              <button 
                key={q.id} 
                onClick={() => navigate(`/play/${q.id}`)} 
                className={`quiz-mission-card quiz-mission-card--${q.difficulty?.toLowerCase() || 'easy'}`}
                style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
              >
                <span className="quiz-mission-card__topline">
                  <span className="quiz-mission-card__index">MISSION {String(index + 1).padStart(2, '0')}</span>
                  {isNewQuiz(q.created_at) && (
                    <span className="quiz-mission-card__new"><SparkleIcon weight="fill" /> NEW</span>
                  )}
                </span>
                <span className="quiz-mission-card__icon"><GameControllerIcon weight="duotone" /></span>
                <span className="quiz-mission-card__title">{q.title}</span>
                <span className="quiz-mission-card__category">{q.category}</span>
                <span className="quiz-mission-card__details">
                  <span>{(q.questions as { count: number }[] | null)?.[0]?.count ?? 0} QUESTIONS</span>
                  <span className={`quiz-mission-card__difficulty quiz-mission-card__difficulty--${q.difficulty?.toLowerCase() || 'easy'}`}>
                    {q.difficulty}
                  </span>
                  <span className="quiz-mission-card__launch">START <ArrowLeftIcon weight="bold" /></span>
                </span>
              </button>
            ))}</div>
          )}
        </section>
      </main>
    </div>
  )
}