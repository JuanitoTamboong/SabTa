// src/pages/QuizGameplay.tsx
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ClockIcon, CheckIcon, XIcon, LightningIcon, 
  SparkleIcon, ArrowLeftIcon, LightbulbIcon
} from '@phosphor-icons/react'

export default function QuizGameplay() {
  const navigate = useNavigate()
  const { quizId } = useParams() // Get the specific quiz ID from the URL
  
  // Game State
  const [questions, setQuestions] = useState<any[]>([])
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(15)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
  
  // Review & Hint State
  const [responses, setResponses] = useState<any[]>([])
  const [showHint, setShowHint] = useState(false)
  const [hintPenalty, setHintPenalty] = useState(0)
  
  // App State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentQuestion = questions[currentQIndex]

  useEffect(() => {
    const initGame = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return navigate('/')

        // 1. Check if user already completed THIS quiz
        const { data: existingAttempt } = await supabase
          .from('quiz_attempts')
          .select('id')
          .eq('user_id', user.id)
          .eq('quiz_id', quizId)
          .single()

        if (existingAttempt) {
          setError("You have already completed this quiz! Please choose another one.")
          setLoading(false)
          return
        }

        // 2. Fetch Quiz & Questions
        const { data: qData, error: qErr } = await supabase
          .from('questions')
          .select('*')
          .eq('quiz_id', quizId)

        if (qErr || !qData || qData.length === 0) {
          setError("Questions not found for this quiz.")
          setLoading(false)
          return
        }

        setQuestions(qData.sort(() => 0.5 - Math.random()))
        setLoading(false)
      } catch (err) {
        setError("An error occurred loading the quiz.")
        setLoading(false)
      }
    }
    initGame()
  }, [navigate, quizId])

  useEffect(() => {
    if (loading || error || isAnswerRevealed || !currentQuestion) return
    if (timeLeft === 0) return handleTimeOut()
    timerRef.current = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [timeLeft, isAnswerRevealed, loading, error, currentQuestion])

  const handleTimeOut = () => {
    setIsAnswerRevealed(true)
    setSelectedAnswer(null)
    recordResponse(null)
    setTimeout(nextQuestion, 2000)
  }

  const handleSelectAnswer = (answer: string) => {
    if (isAnswerRevealed) return
    setSelectedAnswer(answer)
    setIsAnswerRevealed(true)
    if (timerRef.current) clearTimeout(timerRef.current)

    const isCorrect = answer === currentQuestion.correct_answer
    if (isCorrect) {
      const points = Math.max(0, (currentQuestion.points || 10) - hintPenalty)
      setScore((prev) => prev + points)
      setCorrectCount((prev) => prev + 1)
    }
    recordResponse(answer)
    setTimeout(nextQuestion, 1500)
  }

  const recordResponse = (answer: string | null) => {
    setResponses(prev => [...prev, {
      question_text: currentQuestion.question_text,
      selected_answer: answer,
      correct_answer: currentQuestion.correct_answer,
      is_correct: answer === currentQuestion.correct_answer,
    }])
  }

  const handleUseHint = () => {
    if (showHint || isAnswerRevealed) return
    setShowHint(true)
    setHintPenalty(5) 
  }

  const nextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1)
      setSelectedAnswer(null)
      setIsAnswerRevealed(false)
      setShowHint(false)
      setHintPenalty(0)
      setTimeLeft(15)
    } else {
      finishQuiz()
    }
  }

  const finishQuiz = async () => {
    // 1. Save attempt securely to DB (The unique constraint prevents double score)
    await supabase.rpc('submit_quiz_attempt', {
      p_quiz_id: quizId,
      p_correct: correctCount,
      p_incorrect: responses.filter(r => !r.is_correct && r.selected_answer !== null).length,
      p_unanswered: responses.filter(r => r.selected_answer === null).length,
      p_time_taken: 0
    })

    // 2. Go to results screen
    navigate('/results', {
      state: { score, correctCount, totalQuestions: questions.length, quizId, responses }
    })
  }

  if (loading) return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">LOADING...</div>

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
        <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-8 text-center max-w-lg w-full">
          <XIcon weight="bold" className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-gray-400 mb-8">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="w-full bg-[#ccff00] text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2">
            <ArrowLeftIcon weight="bold" /> Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  if (!currentQuestion) return null

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative">
      
      {/* BACK BUTTON */}
      <div className="absolute top-6 left-6 z-20">
        <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-400 hover:text-white transition bg-white/5 px-4 py-2 rounded-xl">
          <ArrowLeftIcon weight="bold" /> Quit Quiz
        </button>
      </div>

      <div className="w-full max-w-3xl relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="text-gray-400 font-mono text-sm">QUESTION {currentQIndex + 1} / {questions.length}</div>
          <div className={`flex items-center gap-2 text-xl font-bold px-4 py-2 rounded-xl border ${timeLeft <= 5 ? 'text-red-500 border-red-500/50 bg-red-500/10 animate-pulse' : 'text-[#00f0ff] border-[#00f0ff]/30 bg-[#00f0ff]/10'}`}>
            <ClockIcon weight="bold" /> 00:{timeLeft.toString().padStart(2, '0')}
          </div>
        </div>

        <div className="w-full h-2 bg-[#0f1014] rounded-full mb-12 overflow-hidden border border-white/5">
          <div className="h-full bg-[#ccff00] transition-all duration-300" style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }} />
        </div>

        <h2 className="text-2xl md:text-3xl font-bold mb-6 text-center leading-snug">{currentQuestion.question_text}</h2>
        
        {!isAnswerRevealed && (
          <div className="flex justify-center mb-6">
            <button onClick={handleUseHint} disabled={showHint} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition ${showHint ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500/50 cursor-not-allowed' : 'bg-transparent border-[#ff00a0]/30 text-[#ff00a0] hover:bg-[#ff00a0]/10'}`}>
              <LightbulbIcon weight="fill" /> 
              {showHint ? 'Hint Revealed (-5 PTS)' : 'Use Hint (-5 PTS)'}
            </button>
          </div>
        )}

        {showHint && (
          <div className="bg-[#ff00a0]/10 border border-[#ff00a0]/20 rounded-xl p-4 mb-6 text-center text-sm text-[#ff00a0]">
            {currentQuestion.hint || "Think carefully about the question."}
          </div>
        )}

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
              <button key={idx} onClick={() => handleSelectAnswer(option)} disabled={isAnswerRevealed} className={`p-6 rounded-2xl text-left text-lg font-semibold transition-all flex justify-between items-center ${btnClass}`}>
                <span className="flex gap-4 items-center">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-mono ${isAnswerRevealed && isCorrect ? 'bg-green-500 text-black' : isAnswerRevealed && isSelected && !isCorrect ? 'bg-red-500 text-white' : 'bg-white/10 text-gray-400'}`}>
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

        <div className="mt-12 flex justify-between items-center text-gray-500 text-sm">
          <div className="flex items-center gap-2"><LightningIcon weight="fill" className="text-[#ccff00]" /> Score: <span className="font-bold text-white">{score}</span></div>
        </div>
      </div>
    </div>
  )
}