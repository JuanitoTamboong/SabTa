// src/pages/QuizGameplay.tsx
import { useEffect, useState, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  ClockIcon, CheckIcon, XIcon, LightningIcon, 
  ArrowLeftIcon, LightbulbIcon, XCircleIcon, TrophyIcon, TargetIcon, StarIcon, CaretDownIcon, CaretUpIcon,
  CoinsIcon, TimerIcon, SwordIcon
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
  
  // ✅ BATTLE MODE DETECTION
  const [searchParams] = useSearchParams()
  const battleId = searchParams.get('battleId')
  const isOpponent = searchParams.get('opponent') === 'true'
  const isBattleMode = !!battleId

  // Game State
  const [questions, setQuestions] = useState<any[]>([])
  const [currentQIndex, setCurrentQIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  
  const [initialTime, setInitialTime] = useState(15)
  const [timeLeft, setTimeLeft] = useState(15)
  
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
  
  // Review & Hint State
  const [responses, setResponses] = useState<any[]>([])
  const [showHint, setShowHint] = useState(false)
  const [showHintModal, setShowHintModal] = useState(false)
  
  // App State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQuitModal, setShowQuitModal] = useState(false)
  
  // User Profile Data
  const [profile, setProfile] = useState<any>(null)
  const [equippedTheme, setEquippedTheme] = useState<string | null>(null) 

  // Results State
  const [isFinished, setIsFinished] = useState(false)
  const [showReview, setShowReview] = useState(false)
  
  // Store the exact database numbers and calculated time
  const [dbResults, setDbResults] = useState<{ 
    points: number, 
    coins: number, 
    accuracy: number, 
    correct: number,
    new_total_points: number,
    new_total_coins: number
  } | null>(null) 
  const [finalTimeTaken, setFinalTimeTaken] = useState<number>(0)
  const [liveElapsedTime, setLiveElapsedTime] = useState<number>(0)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stopwatchRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  const correctCountRef = useRef(0)
  const pointsSpentRef = useRef(0)
  const coinsSpentRef = useRef(0)
  const coinsEarnedRef = useRef(0)
  const quizStartTimeRef = useRef<number>(0)

  const currentQuestion = questions[currentQIndex]

  useEffect(() => {
    const initGame = async () => {
      if (isFinished) return

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return navigate('/')

        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        
        if (profileData) setProfile(profileData)

        // Fetch equipped theme
        const { data: invData } = await supabase
          .from('user_inventory')
          .select('cosmetic_items(cosmetic_type, preview_url)')
          .eq('user_id', user.id)
          .eq('is_equipped', true)

        if (invData) {
          const themeItem = invData.find((item: any) => 
            (item.cosmetic_items as any)?.cosmetic_type === 'quiz_theme'
          )
          if (themeItem && (themeItem.cosmetic_items as any)?.preview_url) {
            setEquippedTheme((themeItem.cosmetic_items as any).preview_url)
          }
        }

        // ✅ BYPASS COMPLETED CHECK IN BATTLE MODE
        if (!isBattleMode) {
          const { data: existingAttempt } = await supabase
            .from('quiz_attempts')
            .select('id')
            .eq('user_id', user.id)
            .eq('quiz_id', quizId)
            .eq('status', 'completed')
            .maybeSingle()

          if (existingAttempt) {
            setError("You have already completed this quiz! Please choose another one.")
            setLoading(false)
            return
          }
        }

        const { data: quizData, error: quizErr } = await supabase
          .from('quizzes')
          .select('time_limit_seconds')
          .eq('id', quizId)
          .single()

        if (quizErr) throw quizErr

        const dbTime = quizData?.time_limit_seconds || 20
        setInitialTime(dbTime)
        setTimeLeft(dbTime)

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
        
        quizStartTimeRef.current = Date.now()
        setLiveElapsedTime(0)
        stopwatchRef.current = setInterval(() => {
          setLiveElapsedTime(Math.floor((Date.now() - quizStartTimeRef.current) / 1000))
        }, 1000)

        setLoading(false)
      } catch (err) {
        setError("An error occurred loading the quiz.")
        setLoading(false)
      }
    }
    initGame()
    
    return () => {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current)
    }
  }, [navigate, quizId, isFinished, isBattleMode])

  useEffect(() => {
    if (loading || error || isAnswerRevealed || !currentQuestion || showQuitModal || showHintModal || isFinished) return
    
    if (timeLeft === 0) return handleTimeOut()
    
    if (timeLeft <= 5) {
      playSound('tick')
    }

    timerRef.current = setTimeout(() => setTimeLeft((prev) => prev - 1), 1000)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [timeLeft, isAnswerRevealed, loading, error, currentQuestion, showQuitModal, showHintModal, isFinished])

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
      setCorrectCount((prev) => prev + 1)
      correctCountRef.current += 1
      coinsEarnedRef.current += 150 
      
      // Only update local coins if NOT in battle mode (battles don't earn coins)
      if (!isBattleMode) {
        setProfile((prev: any) => ({ 
          ...prev, 
          coins: (prev?.coins || 0) + 150 
        }))
      }
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

  const handleUseHint = (payWith: 'points' | 'coins') => {
    // ✅ Disable hints in battle mode to keep it fair
    if (isBattleMode) return alert("Hints are disabled in Battle Mode!")

    if (showHint || isAnswerRevealed) return
    
    if (payWith === 'points') {
      if ((profile?.points || 0) < 5) return alert("Not enough points!")
      pointsSpentRef.current += 5
      setProfile((prev: any) => ({ ...prev, points: Math.max(0, (prev?.points || 0) - 5) }))
    } else {
      if ((profile?.coins || 0) < 50) return alert("Not enough coins!")
      coinsSpentRef.current += 50
      setProfile((prev: any) => ({ ...prev, coins: Math.max(0, (prev?.coins || 0) - 50) }))
    }

    setShowHintModal(false)
    setShowHint(true)
  }

  const nextQuestion = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex((prev) => prev + 1)
      setSelectedAnswer(null)
      setIsAnswerRevealed(false)
      
      setShowHint(false)
      setShowHintModal(false)
      
      setTimeLeft(initialTime) 
      
    } else {
      finishQuiz(correctCountRef.current, pointsSpentRef.current)
    }
  }

  const finishQuiz = async (finalCorrect: number, finalPointsPenalty: number) => {
    try {
      if (stopwatchRef.current) clearInterval(stopwatchRef.current)

      const totalQuestions = questions.length;
      const unansweredCount = responses.filter(r => r.selected_answer === null).length;
      const finalIncorrect = totalQuestions - finalCorrect - unansweredCount; 

      const timeTakenSeconds = Math.floor((Date.now() - quizStartTimeRef.current) / 1000)
      setFinalTimeTaken(timeTakenSeconds) 

      if (isBattleMode) {
        // ✅ BATTLE MODE: Only update the battle score. No coins/points.
        const updateField = isOpponent ? 'opponent_score' : 'challenger_score'
        
        await supabase
          .from('quiz_battles')
          .update({ 
            [updateField]: finalCorrect, // Using correct answers as the score
            status: isOpponent ? 'completed' : 'pending'
          })
          .eq('id', battleId)

        setDbResults({
          points: 0,
          coins: 0,
          accuracy: Math.round((finalCorrect / totalQuestions) * 100),
          correct: finalCorrect,
          new_total_points: profile?.points || 0,
          new_total_coins: profile?.coins || 0
        })
      } else {
        // ✅ NORMAL MODE: Award points/coins securely
        const { data, error } = await supabase.rpc('submit_quiz_attempt', {
          p_quiz_id: quizId,
          p_correct: finalCorrect,
          p_incorrect: finalIncorrect, 
          p_unanswered: unansweredCount, 
          p_time_taken: timeTakenSeconds,
          p_points_penalty: finalPointsPenalty,
          p_coins_earned: coinsEarnedRef.current,
          p_coins_spent: coinsSpentRef.current
        })

        if (error) throw error
        
        if (data) {
          setDbResults({
            points: data.points_earned,
            coins: data.coins_earned,
            accuracy: data.accuracy,
            correct: finalCorrect,
            new_total_points: data.new_total_points,
            new_total_coins: data.new_total_coins
          })
        }
      }
      
    } catch (err) {
      console.error("Error saving quiz:", err)
    } finally {
      setIsFinished(true)
    }
  }

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

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

  if (isFinished) {
    const isPerfect = (dbResults?.correct ?? 0) === questions.length && questions.length > 0

    return (
      <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center p-3 sm:p-6 relative overflow-y-auto">
        
        {equippedTheme && (
          <div className="fixed inset-0 z-0 pointer-events-none w-full h-full overflow-hidden">
            <img src={equippedTheme} alt="bg" className="w-full h-full object-cover opacity-60 md:opacity-40 scale-105" />
            <div className="absolute inset-0 bg-[#050505]/70 md:bg-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/40 to-[#050505] md:bg-gradient-to-br md:from-[#050505]/90 md:via-[#050505]/50 md:to-transparent" />
          </div>
        )}

        <div className="w-full max-w-2xl py-6 md:py-10 relative z-10">
          
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl sm:rounded-[2rem] p-5 sm:p-8 md:p-10 text-center shadow-2xl mb-4 sm:mb-6">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#ccff00] to-green-400 rounded-full flex items-center justify-center mb-4 sm:mb-6 shadow-[0_0_40px_rgba(204,255,0,0.3)]">
              <TrophyIcon weight="fill" className="w-8 h-8 sm:w-10 sm:h-10 text-black" />
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-1 sm:mb-2">
              {isBattleMode ? 'Battle Completed!' : (isPerfect ? 'Flawless Victory!' : 'Quiz Completed!')}
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm md:text-base mb-6 sm:mb-8">
              {isBattleMode ? 'Your score has been submitted. Waiting for the results!' : 'Great effort! Here is your breakdown.'}
            </p>

            <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
              <div className="bg-black/40 border border-[#00f0ff]/30 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-12 h-12 bg-[#00f0ff]/10 rounded-bl-full" />
                <TargetIcon weight="duotone" className="text-[#00f0ff] w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-2" />
                <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase font-bold mb-0.5 sm:mb-1">Score</p>
                <p className="text-xl sm:text-2xl font-bold text-[#00f0ff]">
                  {dbResults?.correct ?? 0}
                </p>
              </div>
              
              <div className="bg-black/40 border border-[#ff00a0]/30 rounded-2xl p-3 sm:p-4 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-12 h-12 bg-[#ff00a0]/10 rounded-bl-full" />
                <CoinsIcon weight="fill" className="text-[#ff00a0] w-5 h-5 sm:w-6 sm:h-6 mb-1 sm:mb-2" />
                <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase font-bold mb-0.5 sm:mb-1">Coins</p>
                <p className="text-xl sm:text-2xl font-bold text-[#ff00a0]">
                  {isBattleMode ? '0' : (dbResults?.coins ?? 0) > 0 ? '+' : ''}
                  {isBattleMode ? '' : dbResults?.coins ?? 0}
                </p>
              </div>
            </div>

            <div className="bg-black/40 border border-[#ccff00]/30 rounded-2xl p-3 sm:p-4 flex items-center justify-center gap-3 sm:gap-4 mb-3 sm:mb-4 relative overflow-hidden">
              <TimerIcon weight="fill" className="text-[#ccff00] w-6 h-6 sm:w-8 sm:h-8" />
              <div className="text-left">
                <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase font-bold mb-0.5 sm:mb-1">Time Taken</p>
                <p className="text-lg sm:text-xl font-bold text-[#ccff00]">{formatTime(finalTimeTaken)}</p>
              </div>
            </div>

            <div className="space-y-2 sm:space-y-3">
              <div>
                <button onClick={() => navigate('/dashboard')} className="w-full bg-[#ccff00] text-black py-3 sm:py-4 rounded-xl text-sm sm:text-base font-bold hover:bg-white transition flex items-center justify-center gap-2">
                  Dashboard <ArrowLeftIcon weight="bold" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!currentQuestion) return null
  
  const canAffordHintPoints = (profile?.points || 0) >= 5
  const canAffordHintCoins = (profile?.coins || 0) >= 50

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-4 sm:p-6 relative">
      
      {equippedTheme && (
        <div className="fixed inset-0 z-0 pointer-events-none w-full h-full overflow-hidden">
          <img src={equippedTheme} alt="theme" className="w-full h-full object-cover opacity-70 md:opacity-50 scale-105" />
          <div className="absolute inset-0 bg-[#050505]/60 md:bg-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/40 to-[#050505] md:bg-gradient-to-br md:from-[#050505]/90 md:via-[#050505]/50 md:to-transparent" />
        </div>
      )}

      <div className="w-full max-w-3xl flex justify-between items-center mb-4 relative z-10">
        <button 
          onClick={() => setShowQuitModal(true)} 
          className="flex items-center gap-1.5 sm:gap-2 text-gray-400 hover:text-red-400 transition bg-black/40 backdrop-blur-md px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border border-white/10"
        >
          <ArrowLeftIcon weight="bold" /> Quit
        </button>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/40 backdrop-blur-md border border-white/10 px-3 sm:px-4 py-2 rounded-xl">
            <TimerIcon weight="fill" className="text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-bold text-gray-300 font-mono text-xs sm:text-base">{formatTime(liveElapsedTime)}</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/40 backdrop-blur-md border border-[#ff00a0]/30 px-3 sm:px-4 py-2 rounded-xl shadow-[0_0_15px_rgba(255,0,160,0.1)]">
            <CoinsIcon weight="fill" className="text-[#ff00a0] w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-bold text-[#ff00a0] text-xs sm:text-base">{profile?.coins || 0}</span>
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl relative z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="text-gray-400 font-mono text-xs sm:text-sm bg-black/40 backdrop-blur-md px-2 py-1 rounded-md">Q {currentQIndex + 1} / {questions.length}</div>
          <div className={`flex items-center gap-1.5 sm:gap-2 text-lg sm:text-xl font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border backdrop-blur-md ${timeLeft <= 5 ? 'text-red-500 border-red-500/50 bg-red-500/20 animate-pulse' : 'text-[#00f0ff] border-[#00f0ff]/30 bg-[#00f0ff]/10'}`}>
            <ClockIcon weight="bold" className="w-5 h-5 sm:w-6 sm:h-6" /> 00:{timeLeft.toString().padStart(2, '0')}
          </div>
        </div>

        <div className="w-full h-1.5 sm:h-2 bg-black/40 backdrop-blur-md rounded-full mb-8 sm:mb-12 overflow-hidden border border-white/5">
          <div className="h-full bg-[#ccff00] transition-all duration-300 shadow-[0_0_10px_rgba(204,255,0,0.5)]" style={{ width: `${((currentQIndex + 1) / questions.length) * 100}%` }} />
        </div>

        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-6 text-center leading-snug drop-shadow-md">{currentQuestion.question_text}</h2>
        
        {!isAnswerRevealed && !isBattleMode && (
          <div className="flex justify-center mb-4 sm:mb-6">
            <button 
              onClick={() => setShowHintModal(true)} 
              disabled={showHint} 
              className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-bold border transition backdrop-blur-md ${
                showHint 
                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500/50 cursor-not-allowed' 
                  : 'bg-black/40 border-[#ff00a0]/30 text-[#ff00a0] hover:bg-[#ff00a0]/10'
              }`}
            >
              <LightbulbIcon weight="fill" /> 
              {showHint ? 'Hint Revealed' : 'Use Hint'}
            </button>
          </div>
        )}

        {showHint && (
          <div className="bg-[#ff00a0]/10 backdrop-blur-md border border-[#ff00a0]/20 rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 text-center text-xs sm:text-sm text-[#ff00a0] font-semibold">
            {currentQuestion.hint || "Think carefully about the question."}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {currentQuestion.options.map((option: string, idx: number) => {
            const isCorrect = option === currentQuestion.correct_answer
            const isSelected = option === selectedAnswer
            let btnClass = "bg-black/40 backdrop-blur-md border border-white/10 hover:border-white/30 hover:bg-white/10"
            if (isAnswerRevealed) {
              if (isCorrect) btnClass = "bg-green-500/20 border-green-500 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
              else if (isSelected && !isCorrect) btnClass = "bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
              else btnClass = "bg-black/40 backdrop-blur-sm border-white/5 opacity-50"
            }
            return (
              <button key={idx} onClick={() => handleSelectAnswer(option)} disabled={isAnswerRevealed} className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl text-left text-sm sm:text-lg font-semibold transition-all flex justify-between items-center ${btnClass}`}>
                <span className="flex gap-2 sm:gap-4 items-center">
                  <span className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs sm:text-sm font-mono ${isAnswerRevealed && isCorrect ? 'bg-green-500 text-black' : isAnswerRevealed && isSelected && !isCorrect ? 'bg-red-500 text-white' : 'bg-white/10 text-gray-400'}`}>
                    {String.fromCharCode(65 + idx)}
                  </span>
                  {option}
                </span>
                {isAnswerRevealed && isCorrect && <CheckIcon weight="bold" className="w-5 h-5 sm:w-6 sm:h-6" />}
                {isAnswerRevealed && isSelected && !isCorrect && <XIcon weight="bold" className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            )
          })}
        </div>

        <div className="mt-8 sm:mt-12 flex justify-between items-center text-gray-500 text-xs sm:text-sm">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5"><TargetIcon weight="fill" className="text-[#00f0ff]" /> Correct: <span className="font-bold text-white">{correctCount}</span></div>
        </div>
      </div>

      {showHintModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 max-w-sm w-full text-center relative shadow-2xl">
            <LightbulbIcon weight="fill" className="w-12 h-12 sm:w-16 sm:h-16 text-yellow-400 mx-auto mb-3 sm:mb-4" />
            <h2 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">Need a Hint?</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-5 sm:mb-6">Choose how you want to pay.</p>
            
            <div className="space-y-2 sm:space-y-3">
              <button 
                onClick={() => handleUseHint('points')}
                disabled={!canAffordHintPoints}
                className="w-full py-3 sm:py-4 bg-[#00f0ff]/10 border border-[#00f0ff]/30 hover:bg-[#00f0ff]/20 text-[#00f0ff] rounded-xl font-bold flex items-center justify-between px-4 sm:px-6 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                <span>Pay with Points ({profile?.points || 0})</span>
                <span className="flex items-center gap-1"><TargetIcon /> -5</span>
              </button>
              
              <button 
                onClick={() => handleUseHint('coins')}
                disabled={!canAffordHintCoins}
                className="w-full py-3 sm:py-4 bg-[#ff00a0]/10 border border-[#ff00a0]/30 hover:bg-[#ff00a0]/20 text-[#ff00a0] rounded-xl font-bold flex items-center justify-between px-4 sm:px-6 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                <span>Pay with Coins ({profile?.coins || 0})</span>
                <span className="flex items-center gap-1"><CoinsIcon weight="fill" /> -50</span>
              </button>
            </div>

            <button 
              onClick={() => setShowHintModal(false)} 
              className="mt-4 sm:mt-6 text-gray-500 hover:text-white text-xs sm:text-sm font-bold transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showQuitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 max-w-sm w-full text-center relative shadow-2xl">
            <XCircleIcon weight="fill" className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-3 sm:mb-4" />
            <h2 className="text-lg sm:text-xl font-bold mb-1 sm:mb-2">Quit Quiz?</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-6 sm:mb-8">
              If you leave now, your progress will be lost and no points will be saved. Are you sure?
            </p>
            <div className="flex gap-2 sm:gap-3">
              <button 
                onClick={() => setShowQuitModal(false)} 
                className="flex-1 py-2.5 sm:py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition text-xs sm:text-sm"
              >
                Resume
              </button>
              <button 
                onClick={() => navigate('/dashboard')} 
                className="flex-1 py-2.5 sm:py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition text-xs sm:text-sm"
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