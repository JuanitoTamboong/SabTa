import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ClockIcon,
  CheckIcon,
  XIcon,
  LightningIcon,
  SparkleIcon,
  ArrowLeftIcon,
} from '@phosphor-icons/react'

export default function QuizGameplay() {
  const navigate = useNavigate()
  
  // Game State
  const [questions, setQuestions] = useState<any[]>([])
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(15)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
  
  // App State
  const [loading, setLoading] = useState(true)
  const [emptyState, setEmptyState] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentQuestion = questions[currentQIndex]

  // 1. Fetch User and Quiz on Mount
  useEffect(() => {
    const initGame = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return navigate('/')

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        if (!profileData || !profileData.age_category) {
          return navigate('/onboarding')
        }
        setProfile(profileData)

        // Fetch a real quiz from the database
        const { data: quizData, error: quizError } = await supabase
          .from('quizzes')
          .select('id, title')
          .eq('age_category', profileData.age_category)
          .eq('status', 'published')
          .limit(1)
          .single()

        if (quizError || !quizData) {
          setEmptyState(true)
          setLoading(false)
          return
        }

        const { data: questionsData, error: qError } = await supabase
          .from('questions')
          .select('*')
          .eq('quiz_id', quizData.id)

        if (qError || !questionsData || questionsData.length === 0) {
          setEmptyState(true)
          setLoading(false)
          return
        }

        const shuffled = questionsData.sort(() => 0.5 - Math.random())
        setQuestions(shuffled)
        setLoading(false)
      } catch (err: any) {
        console.error(err)
        setEmptyState(true)
        setLoading(false)
      }
    }

    initGame()
  }, [navigate])

  // 2. Timer Logic
  useEffect(() => {
    if (loading || emptyState || isAnswerRevealed || !currentQuestion) return

    if (timeLeft === 0) {
      handleTimeOut()
      return
    }

    timerRef.current = setTimeout(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [timeLeft, isAnswerRevealed, loading, emptyState, currentQuestion])

  const handleTimeOut = () => {
    setIsAnswerRevealed(true)
    setSelectedAnswer(null)
    setTimeout(nextQuestion, 2000)
  }

  const handleSelectAnswer = (answer: string) => {
    if (isAnswerRevealed) return

    setSelectedAnswer(answer)
    setIsAnswerRevealed(true)
    if (timerRef.current) clearTimeout(timerRef.current)

    const isCorrect = answer === currentQuestion.correct_answer
    
    if (isCorrect) {
      setScore((prev) => prev + (currentQuestion.points || 10))
      setCorrectCount((prev) => prev + 1)
    }

    setTimeout(nextQuestion, 1500)
  }

  const nextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1)
      setSelectedAnswer(null)
      setIsAnswerRevealed(false)
      setTimeLeft(15)
    } else {
      finishQuiz()
    }
  }

  const finishQuiz = () => {
    navigate('/results', {
      state: {
        score: score,
        correctCount: correctCount,
        totalQuestions: questions.length,
        quizId: questions[0]?.quiz_id || null
      }
    })
  }

  // --- RENDER STATES ---

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono text-xl">
        LOADING ARENA...
      </div>
    )
  }

  // PROFESSIONAL EMPTY STATE (No Demo)
  if (emptyState) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-[#ccff00]/5 rounded-full blur-[120px] pointer-events-none" />
        
        <div className="relative z-10 bg-[#0f1014] border border-white/10 rounded-[2rem] p-8 md:p-12 max-w-lg w-full text-center shadow-2xl">
          <div className="mx-auto w-20 h-20 bg-white/5 border border-white/10 rounded-full flex items-center justify-center mb-6">
            <SparkleIcon weight="duotone" className="w-10 h-10 text-[#ccff00]" />
          </div>
          
          <h1 className="text-3xl font-bold mb-3">The Arena is Preparing...</h1>
          <p className="text-gray-400 text-sm md:text-base mb-8">
            There are no published quizzes for the <span className="text-white font-bold uppercase">{profile?.age_category}</span> tier yet. 
            Please check back later or contact an administrator to publish new challenges.
          </p>

          <button 
            onClick={() => navigate('/dashboard')} 
            className="w-full bg-[#ccff00] text-black py-4 rounded-xl font-bold hover:bg-white transition flex items-center justify-center gap-2"
          >
            <ArrowLeftIcon weight="bold" /> Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!currentQuestion) return null

  // --- ACTIVE GAMEPLAY ---

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-3xl relative z-10">
        
        {/* Top Bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-gray-400 font-mono text-sm">
            QUESTION {currentQIndex + 1} / {questions.length}
          </div>
          <div className={`flex items-center gap-2 text-xl font-bold px-4 py-2 rounded-xl border ${
            timeLeft <= 5 ? 'text-red-500 border-red-500/50 bg-red-500/10 animate-pulse' : 'text-[#00f0ff] border-[#00f0ff]/30 bg-[#00f0ff]/10'
          }`}>
            <ClockIcon weight="bold" /> 00:{timeLeft.toString().padStart(2, '0')}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-[#0f1014] rounded-full mb-12 overflow-hidden border border-white/5">
          <div 
            className="h-full bg-[#ccff00] transition-all duration-300"
            style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }}
          />
        </div>

        {/* Question Area */}
        <h2 className="text-2xl md:text-3xl font-bold mb-10 text-center leading-snug">
          {currentQuestion.question_text}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentQuestion.options.map((option: string, idx: number) => {
            const isCorrect = option === currentQuestion.correct_answer
            const isSelected = option === selectedAnswer
            
            let btnClass = "bg-[#0f1014] border border-white/10 hover:border-white/30 hover:bg-white/5"
            
            if (isAnswerRevealed) {
              if (isCorrect) btnClass = "bg-green-500/20 border-green-500 text-green-400"
              else if (isSelected && !isCorrect) btnClass = "bg-red-500/20 border-red-500 text-red-400"
              else btnClass = "bg-[#0f1014] border-white/5 opacity-50"
            }

            return (
              <button
                key={idx}
                onClick={() => handleSelectAnswer(option)}
                disabled={isAnswerRevealed}
                className={`p-6 rounded-2xl text-left text-lg font-semibold transition-all duration-200 flex justify-between items-center ${btnClass}`}
              >
                <span className="flex gap-4 items-center">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-mono ${
                    isAnswerRevealed && isCorrect ? 'bg-green-500 text-black' : 
                    isAnswerRevealed && isSelected && !isCorrect ? 'bg-red-500 text-white' : 
                    'bg-white/10 text-gray-400'
                  }`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {option}
                </span>
                {isAnswerRevealed && isCorrect && <CheckIcon weight="bold" className="w-6 h-6" />}
                {isAnswerRevealed && isSelected && !isCorrect && <XIcon weight="bold" className="w-6 h-6" />}
              </button>
            )
          })}
        </div>

        {/* Bottom Status */}
        <div className="mt-12 flex justify-between items-center text-gray-500 text-sm">
          <div className="flex items-center gap-2">
            <LightningIcon weight="fill" className="text-[#ccff00]" />
            Score: <span className="font-bold text-white">{score}</span>
          </div>
          <div>
            Difficulty: <span className="text-[#00f0ff] uppercase">Normal</span>
          </div>
        </div>

      </div>
    </div>
  )
}