// src/pages/QuizGameplay.tsx
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ClockIcon, CheckIcon, XIcon, LightningIcon, 
  ArrowLeftIcon, LightbulbIcon, XCircleIcon, TrophyIcon, TargetIcon, StarIcon, CaretDownIcon, CaretUpIcon
} from '@phosphor-icons/react'

// --- SOUND EFFECTS HELPER ---
const playSound = (type: 'correct' | 'wrong' | 'tick') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.connect(gain)
    gain.connect(ctx.destination)

    if (type === 'correct') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
      osc.start()
      osc.stop(ctx.currentTime + 0.3)
    } else if (type === 'wrong') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(150, ctx.currentTime)
      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } else if (type === 'tick') {
      osc.type = 'square'
      osc.frequency.setValueAtTime(400, ctx.currentTime)
      gain.gain.setValueAtTime(0.05, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    }
  } catch (e) {
    console.error("Audio playback failed", e)
  }
}

export default function QuizGameplay() {
  const navigate = useNavigate()
  const { quizId } = useParams()
  
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
  const [showQuitModal, setShowQuitModal] = useState(false)
  
  // NEW: Results State (Replaces the separate /results page)
  const [isFinished, setIsFinished] = useState(false)
  const [showReview, setShowReview] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentQuestion = questions[currentQIndex]

  useEffect(() => {
    const initGame = async () => {
      if (isFinished) return // Don't reload if the quiz is already done

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return navigate('/')

        // 1. Check if user already completed THIS quiz
        const { data: existingAttempt } = await supabase
          .from('quiz_attempts')
          .select('id')
          .eq('user_id', user.id)
          .eq('quiz_id', quizId)
          .maybeSingle()

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
  }, [navigate, quizId, isFinished])

  useEffect(() => {
    if (loading || error || isAnswerRevealed || !currentQuestion || showQuitModal || isFinished) return
    
    if (timeLeft === 0) return handleTimeOut()
    
    if (timeLeft <= 5) {
      playSound('tick')
    }

    timerRef.current = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [timeLeft, isAnswerRevealed, loading, error, currentQuestion, showQuitModal, isFinished])

  const handleTimeOut = () => {
    playSound('wrong')
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
      playSound('correct')
      const points = Math.max(0, (currentQuestion.points || 10) - hintPenalty)
      setScore((prev) => prev + points)
      setCorrectCount((prev) => prev + 1)
    } else {
      playSound('wrong')
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
    setIsFinished(true)

    // Save the score safely to database
    await supabase.rpc('submit_quiz_attempt', {
      p_quiz_id: quizId,
      p_correct: correctCount,
      p_incorrect: responses.filter(r => !r.is_correct && r.selected_answer !== null).length,
      p_unanswered: responses.filter(r => r.selected_answer === null).length,
      p_time_taken: 0
    })
  }

  // --- RENDER STATES ---

  if (loading) return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">LOADING...</div>

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6">
        <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-8 text-center max-w-lg w-full">
          <XCircleIcon weight="fill" className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Quiz Unavailable</h1>
          <p className="text-gray-400 mb-8">{error}</p>
          <button onClick={() => navigate('/dashboard')} className="w-full bg-[#ccff00] text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2">
            <ArrowLeftIcon weight="bold" /> Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // --- RESULTS SCREEN (Combined instead of separate page) ---
  if (isFinished) {
    const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0
    const isPerfect = correctCount === questions.length && questions.length > 0

    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center p-6 relative overflow-y-auto">
        <div className="w-full max-w-2xl py-10 relative z-10">
          
          <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-6 md:p-10 text-center shadow-2xl mb-6">
            <div className="mx-auto w-20 h-20 bg-gradient-to-br from-[#ccff00] to-green-400 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(204,255,0,0.3)]">
              <TrophyIcon weight="fill" className="w-10 h-10 text-black" />
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              {isPerfect ? 'Flawless Victory!' : 'Quiz Completed!'}
            </h1>
            <p className="text-gray-400 text-sm md:text-base mb-8">
              {isPerfect ? 'You got every single question right. Amazing!' : 'Great effort! Here is your breakdown.'}
            </p>

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
                <CheckIcon weight="duotone" className="text-[#ccff00] w-6 h-6 mb-2" />
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Correct</p>
                <p className="text-lg md:text-xl font-bold text-[#ccff00]">{correctCount}/{questions.length}</p>
              </div>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => setShowReview(!showReview)} 
                className="w-full bg-[#00f0ff]/10 text-[#00f0ff] py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-[#00f0ff]/20 transition border border-[#00f0ff]/20"
              >
                {showReview ? <CaretUpIcon weight="bold" /> : <CaretDownIcon weight="bold" />}
                {showReview ? 'Hide Answer Breakdown' : 'Review Your Answers'}
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => navigate('/dashboard')} className="w-full bg-[#ccff00] text-black py-4 rounded-xl font-bold hover:bg-white transition flex items-center justify-center gap-2">
                  Dashboard <ArrowLeftIcon weight="bold" />
                </button>
                <button onClick={() => navigate('/play/new')} className="w-full bg-white/5 text-white py-4 rounded-xl font-bold hover:bg-white/10 transition border border-white/5">
                  Play Again
                </button>
              </div>
            </div>
          </div>

          {showReview && (
            <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl">
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                <TargetIcon className="text-[#ccff00]" /> Answer Breakdown
              </h3>
              <div className="space-y-4">
                {responses.map((r: any, i: number) => (
                  <div key={i} className="bg-black/40 border border-white/5 rounded-2xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      {r.is_correct ? (
                        <CheckIcon weight="fill" className="text-green-500 w-6 h-6 shrink-0" />
                      ) : (
                        <XIcon weight="fill" className="text-red-500 w-6 h-6 shrink-0" />
                      )}
                      <p className="font-bold text-sm md:text-base leading-tight">{r.question_text}</p>
                    </div>
                    <div className="pl-9 space-y-2">
                      <p className="text-xs md:text-sm text-gray-400">
                        Your Answer: <span className={`font-bold ${r.is_correct ? 'text-green-400' : 'text-red-400'}`}>
                          {r.selected_answer || 'Skipped / Timed Out'}
                        </span>
                      </p>
                      {!r.is_correct && (
                        <p className="text-xs md:text-sm text-gray-400">
                          Correct Answer: <span className="text-green-400 font-bold">{r.correct_answer}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // --- ACTIVE GAMEPLAY ---
  if (!currentQuestion) return null
  const canAffordHint = score >= 5

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative">
      
      {/* BACK BUTTON */}
      <div className="w-full max-w-3xl flex justify-start mb-4">
        <button 
          onClick={() => setShowQuitModal(true)} 
          className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition bg-white/5 px-4 py-2 rounded-xl text-sm font-bold"
        >
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
            <button 
              onClick={handleUseHint} 
              disabled={showHint || !canAffordHint} 
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border transition ${
                showHint 
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500/50 cursor-not-allowed' 
                  : !canAffordHint 
                    ? 'bg-red-500/10 border-red-500/20 text-red-500/50 cursor-not-allowed'
                    : 'bg-transparent border-[#ff00a0]/30 text-[#ff00a0] hover:bg-[#ff00a0]/10'
              }`}
            >
              <LightbulbIcon weight="fill" /> 
              {showHint 
                ? 'Hint Revealed (-5 PTS)' 
                : !canAffordHint 
                  ? 'Not enough points for Hint' 
                  : 'Use Hint (-5 PTS)'}
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

      {/* QUIT CONFIRMATION MODAL */}
      {showQuitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-8 max-w-sm w-full text-center relative shadow-2xl">
            <XCircleIcon weight="fill" className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Quit Quiz?</h2>
            <p className="text-gray-400 text-sm mb-8">
              If you leave now, your progress will be lost and no points will be saved. Are you sure?
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowQuitModal(false)} 
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition"
              >
                Resume Quiz
              </button>
              <button 
                onClick={() => navigate('/dashboard')} 
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition"
              >
                Quit
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}