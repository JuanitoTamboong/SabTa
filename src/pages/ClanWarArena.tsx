// src/pages/ClanWarArena.tsx
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import { 
  SwordIcon, ShieldIcon, ClockIcon, CheckCircleIcon, 
  WarningCircleIcon, CaretLeftIcon, TrophyIcon, LockIcon,
  FireIcon, UsersIcon, TimerIcon, SkullIcon, WarningIcon,
  StarIcon, BookOpenIcon, XCircleIcon
} from '@phosphor-icons/react'
import { useNotifications } from './notifications/NotificationsProvider'
import '../css/UserDashboard.css'

const TEAM_LABELS: Record<number, string> = {
  2: '2 vs 2', 3: '3 vs 3', 4: '4 vs 4', 5: '5 vs 5',
}
const teamLabel = (n: number | null | undefined) =>
  n && TEAM_LABELS[n] ? TEAM_LABELS[n] : '—'

export default function ClanWarArena() {
  const { warId } = useParams()
  const navigate = useNavigate()
  const { profile } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [warData, setWarData] = useState<any>(null)
  const [clanAFighters, setClanAFighters] = useState<any[]>([])
  const [clanBFighters, setClanBFighters] = useState<any[]>([])
  const [timeLeft, setTimeLeft] = useState<{h: string, m: string, s: string}>({h: '00', m: '00', s: '00'})
  const [isWarActive, setIsWarActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Quiz State
  const [quizMeta, setQuizMeta] = useState<any>(null)
  const [questions, setQuestions] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [questionTimer, setQuestionTimer] = useState(20)

  // Review toggle state
  const [showReview, setShowReview] = useState(false)

  // Rules Modal State
  const [showRules, setShowRules] = useState(false)
  const [rulesAcknowledged, setRulesAcknowledged] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // 🔥 Prevents double clicks instantly (before state updates)
  const isProcessingClick = useRef(false)

  const fetchFighters = async () => {
    if (!warId) return
    const { data: war } = await supabase.from('clan_wars').select('clan_a_id, clan_b_id').eq('id', warId).single()
    if (!war) return

    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

    const { data: attacks } = await supabase
      .from('clan_war_attacks')
      .select('user_id, points, attack_day')
      .eq('war_id', warId)

    const warPointsMap: Record<string, number> = {}
    const attackedTodayMap: Record<string, boolean> = {}

    attacks?.forEach(a => {
      warPointsMap[a.user_id] = (warPointsMap[a.user_id] || 0) + a.points
      if (a.attack_day === todayStr) {
        attackedTodayMap[a.user_id] = true
      }
    })

    const { data: lb } = await supabase.rpc('get_season_leaderboard')
    const seasonPointsMap: Record<string, number> = {}
    lb?.forEach((p: any) => { seasonPointsMap[p.id] = p.points })

    const getBadge = (points: number) => {
      if (points <= 1500) return { name: 'Normal', color: 'text-orange-400', border: 'border-orange-400/50' }
      if (points <= 5000) return { name: 'Intermediate', color: 'text-[#ccff00]', border: 'border-[#ccff00]/50' }
      return { name: 'Hard', color: 'text-purple-400', border: 'border-purple-400/50' }
    }

    let mappedA: any[] = []
    let mappedB: any[] = []

    if (war.clan_a_id) {
      const { data: fightersA } = await supabase
        .from('clan_war_fighters')
        .select(`user_id, profiles(display_name, avatar_url, user_inventory ( is_equipped, cosmetic_items ( cosmetic_type, preview_url ) ))`)
        .eq('war_id', warId)
        .eq('clan_id', war.clan_a_id)
        
      mappedA = (fightersA || []).map((f: any) => {
        const seasonPts = seasonPointsMap[f.user_id] || 0;
        return {
          ...f,
          war_points: warPointsMap[f.user_id] || 0,
          season_points: seasonPts,
          badge: getBadge(seasonPts),
          hasAttackedToday: attackedTodayMap[f.user_id] || false
        }
      }).sort((a, b) => b.season_points - a.season_points)
    }
    
    if (war.clan_b_id) {
      const { data: fightersB } = await supabase
        .from('clan_war_fighters')
        .select(`user_id, profiles(display_name, avatar_url, user_inventory ( is_equipped, cosmetic_items ( cosmetic_type, preview_url ) ))`)
        .eq('war_id', warId)
        .eq('clan_id', war.clan_b_id)
        
      mappedB = (fightersB || []).map((f: any) => {
        const seasonPts = seasonPointsMap[f.user_id] || 0;
        return {
          ...f,
          war_points: warPointsMap[f.user_id] || 0,
          season_points: seasonPts,
          badge: getBadge(seasonPts),
          hasAttackedToday: attackedTodayMap[f.user_id] || false
        }
      }).sort((a, b) => b.season_points - a.season_points)
    }

    const maxSlots = Math.max(mappedA.length, mappedB.length)
    for (let i = 0; i < maxSlots; i++) {
      const fA = mappedA[i]
      const fB = mappedB[i]
      
      const ptsA = fA ? fA.season_points : 0
      const ptsB = fB ? fB.season_points : 0
      const maxPts = Math.max(ptsA, ptsB)
      
      const matchupBadge = getBadge(maxPts)
      
      if (fA) fA.matchupBadge = matchupBadge
      if (fB) fB.matchupBadge = matchupBadge
    }

    setClanAFighters(mappedA)
    setClanBFighters(mappedB)
  }

  useEffect(() => {
    const fetchWar = async () => {
      if (!warId) return

      const { data: war, error: warError } = await supabase
        .from('clan_wars')
        .select(`*, clan_a:clan_a_id (id, name, tag, avatar_url), clan_b:clan_b_id (id, name, tag, avatar_url)`)
        .eq('id', warId)
        .single()

      if (warError) {
        setError("War not found.")
        setLoading(false)
        return
      }
      setWarData(war)
      await fetchFighters()
      setLoading(false)

      // 🔥 FIX: Safe check for null starts_at
      const checkWarStatus = () => {
        if (!war.starts_at) {
          setIsWarActive(false)
          setTimeLeft({ h: '--', m: '--', s: '--' })
          return
        }

        const startTime = new Date(war.starts_at).getTime()
        const now = Date.now()
        
        if (now >= startTime) {
          setIsWarActive(true)
          if (timerRef.current) clearInterval(timerRef.current)
        } else {
          setIsWarActive(false)
          const diff = startTime - now
          const h = Math.floor(diff / (1000 * 60 * 60))
          const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
          const s = Math.floor((diff % (1000 * 60)) / 1000)
          setTimeLeft({
            h: h.toString().padStart(2, '0'),
            m: m.toString().padStart(2, '0'),
            s: s.toString().padStart(2, '0')
          })
        }
      }

      checkWarStatus()
      timerRef.current = setInterval(checkWarStatus, 1000)
    }

    fetchWar()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [warId])

  useEffect(() => {
    if (!warId) return
    const channel = supabase
      .channel(`war-arena-live-${warId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clan_wars', filter: `id=eq.${warId}` }, (payload) => {
        setWarData((prev: any) => ({ ...prev, ...payload.new }))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_war_fighters', filter: `war_id=eq.${warId}` }, () => {
        fetchFighters()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clan_war_attacks', filter: `war_id=eq.${warId}` }, () => {
        fetchFighters()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [warId])

  useEffect(() => {
    const fetchQuiz = async () => {
      // 🔥 FIX: Add isWarActive check
      if (!isWarActive || !warId || result || rulesAcknowledged) return
      
      const { data: existingAttack } = await supabase
        .from('clan_war_attacks')
        .select('*, clan_war_attempts(*)')
        .eq('war_id', warId)
        .eq('user_id', profile?.id)
        .maybeSingle() 

      if (existingAttack?.clan_war_attempts) {
        setResult(existingAttack.clan_war_attempts)
        return
      }

      const { data, error } = await supabase.rpc('get_war_quiz_for_fighter', { p_war_id: warId })
      
      if (error) { 
        setError(error.message)
        return 
      }
      
      setQuizMeta(data.quiz)
      setQuestions(data.questions)
      setQuestionTimer(data.quiz.time_limit_seconds || 20)
      
      setShowRules(true)
    }
    
    fetchQuiz()
  }, [isWarActive, warId, profile?.id, result, rulesAcknowledged])

  useEffect(() => {
    if (rulesAcknowledged && quizMeta?.time_limit_seconds) {
      setQuestionTimer(quizMeta.time_limit_seconds);
    }
  }, [rulesAcknowledged, quizMeta]);

  useEffect(() => {
    if (!isWarActive || !questions.length || result || !rulesAcknowledged) return
    
    if (questionTimer <= 0) { 
      handleNext(); 
      return 
    }
    
    const t = setTimeout(() => setQuestionTimer(prev => prev - 1), 1000)
    return () => clearTimeout(t)
  }, [questionTimer, isWarActive, questions, result, rulesAcknowledged])

  const handleSelectOption = (option: string) => {
    if (isProcessingClick.current || isSubmitting) return
    
    isProcessingClick.current = true

    setAnswers(prev => ({ ...prev, [questions[currentIndex].id]: option }))
    
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)
    
    autoAdvanceRef.current = setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(prev => prev + 1)
        setQuestionTimer(quizMeta?.time_limit_seconds || 20)
        isProcessingClick.current = false
      } else {
        handleSubmit(false, { ...answers, [questions[currentIndex].id]: option })
      }
    }, 500)
  }

  const handleNext = () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current)

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setQuestionTimer(quizMeta?.time_limit_seconds || 20)
      isProcessingClick.current = false
    } else {
      handleSubmit()
    }
  }

  const handleSubmit = async (isForfeit = false, finalAnswers = answers) => {
    if (isSubmitting || !warId || !profile?.id) return
    setIsSubmitting(true)
    isProcessingClick.current = true

    const formattedAnswers = questions.map(q => ({
      question_id: q.id,
      selected_answer: isForfeit ? null : (finalAnswers[q.id] || null),
      response_time_seconds: 0
    }))

    const { data, error } = await supabase.rpc('submit_clan_war_quiz_attempt', {
      p_war_id: warId,
      p_quiz_id: quizMeta?.id, 
      p_answers: formattedAnswers,
      p_time_taken_seconds: 120
    })
    
    setIsSubmitting(false)
    if (error) { setError("Failed to submit score: " + error.message); return }
    
    await fetchFighters()
    setResult(data)
    setShowReview(true)
  }

  if (loading) return <LoadingScreen title="Entering the Arena" subtitle="Loading war details..." />

  if (error) {
    return (
      <div className="game-dashboard flex items-center justify-center p-4">
        <div className="game-panel p-8 max-w-md w-full text-center">
          <WarningCircleIcon weight="fill" className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-black text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 text-sm mb-6">{error}</p>
          <button onClick={() => navigate('/clans')} className="game-button game-button--primary w-full">Return to Clans</button>
        </div>
      </div>
    )
  }

  // ================= PRE-WAR LOBBY =================
  if (!isWarActive) {
    const ts: number = warData?.team_size ?? 5
    return (
      <div className="game-dashboard">
        <div className="game-content max-w-5xl mx-auto pt-6">
          <div className="text-center mb-4">
            <span className="game-kicker"><SwordIcon weight="fill" /> War Lobby</span>
            <h1 className="text-2xl font-black text-white mt-1">The Battle Begins</h1>
            <p className="text-gray-400 text-[10px] mt-1">{teamLabel(ts)} · Review your enemy and prepare your fighters.</p>
          </div>

          <div className="game-panel mb-4">
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-black/20">
              <h3 className="text-[10px] font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                <UsersIcon weight="fill" className="text-[#ccff00]" /> Matchup Map
              </h3>
              <span className="game-quest-chip">{teamLabel(ts)}</span>
            </div>
            
            <div className="p-3 flex flex-col md:flex-row items-stretch relative">
              {/* Clan A */}
              <div className="flex-1 w-full">
                <div className="flex items-center gap-2 mb-3 border-b border-[#ccff00]/20 pb-2">
                  <div className="w-8 h-8 rounded-lg bg-black/50 border border-[#ccff00]/30 overflow-hidden flex items-center justify-center shrink-0">
                    {warData.clan_a?.avatar_url ? <img src={warData.clan_a.avatar_url} className="w-full h-full object-cover" /> : <span className="text-[#ccff00] font-bold text-xs">{warData.clan_a?.tag}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] text-[#ccff00] font-bold uppercase tracking-widest">Clan A</p>
                    <h2 className="text-xs font-black text-white truncate">{warData.clan_a?.name}</h2>
                  </div>
                </div>
                
                <p className="text-[8px] text-gray-500 uppercase font-bold mb-1">Roster ({clanAFighters.length}/{ts})</p>
                <div className="space-y-1">
                  {clanAFighters.map((f: any, i: number) => {
                    const equippedBorder = f.profiles?.user_inventory?.find((inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'avatar_border')
                    const borderUrl = Array.isArray(equippedBorder?.cosmetic_items) ? equippedBorder.cosmetic_items[0]?.preview_url : equippedBorder?.cosmetic_items?.preview_url
                    
                    return (
                      <div key={f.user_id} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black/30 border border-white/5">
                        <span className="text-[8px] font-bold text-gray-500 w-3">{i + 1}</span>
                        <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                          <div className="absolute inset-[15%] rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-[7px] font-bold text-gray-400 z-10">
                            {f.profiles?.avatar_url ? <img src={f.profiles.avatar_url} className="w-full h-full object-cover" /> : f.profiles?.display_name?.charAt(0)}
                          </div>
                          {borderUrl && <img src={borderUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />}
                        </div>
                        <span className="text-[10px] text-white font-bold truncate flex-1">{f.profiles?.display_name}</span>
                        
                        <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase border ${f.matchupBadge.border} ${f.matchupBadge.color} bg-black/30`}>
                          {f.matchupBadge.name}
                        </span>
                        <span className="text-[8px] font-mono text-gray-400">{f.season_points} SP</span>

                        {f.hasAttackedToday ? (
                          <span className="text-[8px] bg-green-500/20 text-green-400 px-1 py-0.5 rounded font-bold uppercase border border-green-500/30">Done</span>
                        ) : (
                          <span className="text-[8px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-bold uppercase border border-red-500/30 animate-pulse">Pending</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* VS Badge */}
              <div className="flex items-center justify-center py-2 md:py-0 md:px-4 shrink-0">
                <div className="w-8 h-8 rounded-full bg-[#050505] border-2 border-[#ccff00] flex items-center justify-center text-[10px] font-black text-[#ccff00] shadow-[0_0_15px_rgba(204,255,0,0.2)]">
                  VS
                </div>
              </div>

              {/* Clan B */}
              <div className="flex-1 w-full">
                <div className="flex items-center gap-2 mb-3 border-b border-red-500/20 pb-2">
                  <div className="w-8 h-8 rounded-lg bg-black/50 border border-red-500/30 overflow-hidden flex items-center justify-center shrink-0">
                    {warData.clan_b?.avatar_url ? <img src={warData.clan_b.avatar_url} className="w-full h-full object-cover" /> : <span className="text-red-400 font-bold text-xs">{warData.clan_b?.tag}</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] text-red-400 font-bold uppercase tracking-widest">Clan B</p>
                    <h2 className="text-xs font-black text-white truncate">{warData.clan_b?.name}</h2>
                  </div>
                </div>
                
                <p className="text-[8px] text-gray-500 uppercase font-bold mb-1">Roster ({clanBFighters.length}/{ts})</p>
                <div className="space-y-1">
                  {clanBFighters.map((f: any, i: number) => {
                    const equippedBorder = f.profiles?.user_inventory?.find((inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'avatar_border')
                    const borderUrl = Array.isArray(equippedBorder?.cosmetic_items) ? equippedBorder.cosmetic_items[0]?.preview_url : equippedBorder?.cosmetic_items?.preview_url
                    
                    return (
                      <div key={f.user_id} className="flex items-center gap-1.5 p-1.5 rounded-lg bg-black/30 border border-white/5">
                        <span className="text-[8px] font-bold text-gray-500 w-3">{i + 1}</span>
                        <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                          <div className="absolute inset-[15%] rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-[7px] font-bold text-gray-400 z-10">
                            {f.profiles?.avatar_url ? <img src={f.profiles.avatar_url} className="w-full h-full object-cover" /> : f.profiles?.display_name?.charAt(0)}
                          </div>
                          {borderUrl && <img src={borderUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />}
                        </div>
                        <span className="text-[10px] text-white font-bold truncate flex-1">{f.profiles?.display_name}</span>
                        
                        <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase border ${f.matchupBadge.border} ${f.matchupBadge.color} bg-black/30`}>
                          {f.matchupBadge.name}
                        </span>
                        <span className="text-[8px] font-mono text-gray-400">{f.season_points} SP</span>

                        {f.hasAttackedToday ? (
                          <span className="text-[8px] bg-green-500/20 text-green-400 px-1 py-0.5 rounded font-bold uppercase border border-green-500/30">Done</span>
                        ) : (
                          <span className="text-[8px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-bold uppercase border border-red-500/30 animate-pulse">Pending</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="game-panel mb-4">
            <div className="p-2 border-b border-white/10 flex items-center justify-center gap-2 bg-black/20">
              <ClockIcon weight="bold" className="w-3 h-3 text-purple-400" />
              <h3 className="text-[10px] font-bold text-white uppercase tracking-widest">
                {/* 🔥 FIX: Dynamic header based on starts_at */}
                {warData.starts_at ? 'War Begins In' : 'Waiting for Opponent'}
              </h3>
            </div>
            
            {warData.starts_at ? (
              <div className="p-4 flex items-center justify-center gap-2">
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-black/50 border border-purple-500/30 rounded-lg flex items-center justify-center">
                    <span className="text-xl font-mono font-black text-[#ccff00]">{timeLeft.h}</span>
                  </div>
                  <p className="text-[7px] font-bold text-gray-500 uppercase mt-1">Hours</p>
                </div>
                <span className="text-lg text-purple-400 font-black mb-4">:</span>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-black/50 border border-purple-500/30 rounded-lg flex items-center justify-center">
                    <span className="text-xl font-mono font-black text-[#ccff00]">{timeLeft.m}</span>
                  </div>
                  <p className="text-[7px] font-bold text-gray-500 uppercase mt-1">Minutes</p>
                </div>
                <span className="text-lg text-purple-400 font-black mb-4">:</span>
                <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-black/50 border border-purple-500/30 rounded-lg flex items-center justify-center animate-pulse">
                    <span className="text-xl font-mono font-black text-[#ccff00]">{timeLeft.s}</span>
                  </div>
                  <p className="text-[7px] font-bold text-gray-500 uppercase mt-1">Seconds</p>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center animate-pulse">
                <p className="text-sm font-bold text-gray-400">
                  The countdown will start once the enemy clan joins the arena.
                </p>
              </div>
            )}
          </div>

          <button onClick={() => navigate('/clans')} className="game-button game-button--quiet w-full py-2 text-xs">
            <CaretLeftIcon weight="bold" /> Back to Clans
          </button>
        </div>
      </div>
    )
  }

  // ================= RULES WARNING MODAL =================
  if (showRules && !rulesAcknowledged) {
    return (
      <div className="game-dashboard flex items-center justify-center p-4">
        <div className="game-panel p-6 md:p-8 max-w-md w-full text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(234,179,8,0.3)]">
            <WarningIcon weight="fill" className="w-8 h-8 text-black" />
          </div>
          
          <h2 className="text-xl font-black text-white mb-2">Rules of Engagement</h2>
          
          <p className="text-sm text-gray-400 mb-6">
            You are about to take a <strong className={`uppercase ${
              quizMeta?.difficulty === 'hard' ? 'text-red-400' : 
              quizMeta?.difficulty === 'intermediate' ? 'text-purple-400' : 'text-[#ccff00]'
            }`}>{quizMeta?.difficulty}</strong> difficulty quiz. Please read carefully before entering the battle arena.
          </p>
          
          <div className="bg-black/40 border border-white/10 rounded-xl p-4 text-left space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">1</div>
              <p className="text-xs text-gray-300"><strong className="text-white">No Leaving:</strong> Leaving the page will submit your current progress.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">2</div>
              <p className="text-xs text-gray-300"><strong className="text-white">No Refreshing:</strong> Refreshing auto-submits your current score.</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-black text-xs shrink-0 mt-0.5">3</div>
              <p className="text-xs text-gray-300"><strong className="text-white">One Attempt Only:</strong> You can only attack once per day.</p>
            </div>
          </div>

          {/* Back & Start buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <button
              onClick={() => navigate('/clans')}
              className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl transition text-sm flex items-center justify-center gap-2"
            >
              Cancel
            </button>
            <button
              onClick={() => setRulesAcknowledged(true)}
              className="flex-[2] py-3 bg-[#ccff00] hover:bg-[#b3e600] !text-black font-black tracking-wide rounded-xl transition text-sm shadow-[0_0_20px_rgba(204,255,0,0.2)]"
            >
              I Understand, Start Quiz
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ================= POST-WAR RESULTS =================
  if (result) {
    const myClanId = profile?.clan_id
    const isClanA = warData?.clan_a_id === myClanId
    
    const myClan: any = isClanA ? warData?.clan_a : warData?.clan_b
    const enemyClan: any = isClanA ? warData?.clan_b : warData?.clan_a
    const myFighters = isClanA ? clanAFighters : clanBFighters
    const enemyFighters = isClanA ? clanBFighters : clanAFighters

    const myScore = myFighters.reduce((sum, f) => sum + (f.war_points || 0), 0)
    const enemyScore = enemyFighters.reduce((sum, f) => sum + (f.war_points || 0), 0)
    
    const isWin = myScore > enemyScore
    const isDraw = myScore === enemyScore
    
    const maxAttacks = warData?.max_attacks_per_day || warData?.team_size || 5
    const myAttacksDone = myFighters.filter((f: any) => f.hasAttackedToday).length
    const enemyAttacksDone = enemyFighters.filter((f: any) => f.hasAttackedToday).length
    
    const allAttacksFinished = myAttacksDone >= maxAttacks && enemyAttacksDone >= maxAttacks
    const isWarFinished = warData?.status === 'completed' || allAttacksFinished

    const reviewLog: any[] = Array.isArray(result?.detailed_answers)
      ? result.detailed_answers
      : []

    return (
      <div className="game-dashboard flex items-center justify-center p-4">
        <div className="game-panel p-6 max-w-2xl w-full">
          
          <div className="text-center mb-6">
            <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 shadow-2xl ${
              isWarFinished 
                ? (isDraw ? 'bg-gradient-to-br from-gray-400 to-gray-600' : isWin ? 'bg-gradient-to-br from-[#ccff00] to-green-400' : 'bg-gradient-to-br from-red-500 to-orange-600')
                : 'bg-gradient-to-br from-purple-500 to-indigo-600'
            }`}>
              {isWarFinished 
                ? (isDraw ? <ShieldIcon weight="fill" className="w-10 h-10 text-black" /> : isWin ? <TrophyIcon weight="fill" className="w-10 h-10 text-black" /> : <SkullIcon weight="fill" className="w-10 h-10 text-black" />)
                : <ClockIcon weight="fill" className="w-10 h-10 text-white" />}
            </div>
            <h2 className={`text-2xl md:text-3xl font-black mb-2 ${
              isWarFinished 
                ? (isDraw ? 'text-gray-400' : isWin ? 'text-[#ccff00]' : 'text-red-400') 
                : 'text-white'
            }`}>
              {isWarFinished ? (isDraw ? 'DRAW' : isWin ? 'VICTORY!' : 'DEFEAT') : 'ATTACK SUBMITTED!'}
            </h2>
            <p className="text-xs md:text-sm text-gray-400">
              {isWarFinished ? (
                <>{myClan?.name} <span className="text-gray-600 mx-2">vs</span> {enemyClan?.name}</>
              ) : (
                <>Waiting for other fighters to finish their attacks...</>
              )}
            </p>
          </div>

          <div className="bg-black/40 rounded-xl border border-white/10 p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#ccff00]/20 flex items-center justify-center border border-[#ccff00]/30">
                <ShieldIcon weight="fill" className="w-3.5 h-3.5 text-[#ccff00]" />
              </div>
              <div>
                <p className="text-[8px] text-gray-500 uppercase font-bold">Your Clan</p>
                <p className="text-xs font-black text-[#ccff00]">{myClan?.name} <span className="text-gray-500">({myClan?.tag})</span></p>
              </div>
            </div>
            
            <div className="w-6 h-6 rounded-full bg-black border border-white/10 flex items-center justify-center text-[8px] font-black text-gray-500">
              VS
            </div>
            
            <div className="flex items-center gap-2 text-right">
              <div>
                <p className="text-[8px] text-gray-500 uppercase font-bold">Opponent</p>
                <p className="text-xs font-black text-red-400">{enemyClan?.name} <span className="text-gray-500">({enemyClan?.tag})</span></p>
              </div>
              <div className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center border border-red-500/30">
                <SwordIcon weight="fill" className="w-3.5 h-3.5 text-red-400" />
              </div>
            </div>
          </div>

          <div className="bg-black/40 rounded-xl border border-white/10 p-4 mb-6">
            <p className="text-[9px] text-gray-500 uppercase font-bold text-center mb-3 tracking-wider">Current Clan Scores</p>
            <div className="flex items-center justify-between">
              <div className="text-center flex-1">
                <p className={`text-xs font-bold mb-1 ${isClanA ? 'text-[#ccff00]' : 'text-red-400'}`}>{myClan?.tag}</p>
                <p className={`text-3xl font-black ${
                  isWarFinished ? (isDraw ? 'text-gray-400' : isWin ? 'text-[#ccff00]' : 'text-white') : 'text-white'
                }`}>{myScore}</p>
              </div>
              <div className="px-4 flex flex-col items-center">
                <span className="text-[10px] text-gray-600 font-bold">VS</span>
              </div>
              <div className="text-center flex-1">
                <p className={`text-xs font-bold mb-1 ${!isClanA ? 'text-[#ccff00]' : 'text-red-400'}`}>{enemyClan?.tag}</p>
                <p className={`text-3xl font-black ${
                  isWarFinished ? (isDraw ? 'text-gray-400' : !isWin ? 'text-[#ccff00]' : 'text-white') : 'text-white'
                }`}>{enemyScore}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <StarIcon weight="fill" className="text-[#ccff00]" /> Your Attack Review
            </h3>
            <div className="bg-black/30 rounded-xl p-3 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-[9px] font-bold text-gray-400">
                    {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : profile?.display_name?.charAt(0)}
                  </div>
                  <span className="text-xs font-bold text-white">{profile?.display_name}</span>
                </div>
                <span className="text-sm font-black text-[#ccff00]">{result.score} pts</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-1.5 text-center">
                  <p className="text-sm font-black text-green-400">{result.correct}</p>
                  <p className="text-[8px] text-gray-500 uppercase font-bold">Correct</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-1.5 text-center">
                  <p className="text-sm font-black text-red-400">{result.incorrect}</p>
                  <p className="text-[8px] text-gray-500 uppercase font-bold">Wrong</p>
                </div>
                <div className="bg-gray-500/10 border border-gray-500/20 rounded-lg p-1.5 text-center">
                  <p className="text-sm font-black text-gray-300">{result.unanswered}</p>
                  <p className="text-[8px] text-gray-500 uppercase font-bold">Skipped</p>
                </div>
              </div>
            </div>
          </div>

          {/* ===================== DETAILED ANSWER REVIEW ===================== */}
          {reviewLog.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowReview(v => !v)}
                className="w-full text-[10px] font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-between hover:text-[#ccff00] transition"
              >
                <span className="flex items-center gap-1.5">
                  <BookOpenIcon weight="fill" className="text-[#ccff00]" />
                  Review Your Answers ({reviewLog.length})
                </span>
                <span className={`text-[10px] font-black transition-transform ${showReview ? 'rotate-90' : ''}`}>
                  ▶
                </span>
              </button>

              {showReview && (
                <div className="space-y-2">
                  {reviewLog.map((a: any, idx: number) => {
                    const skipped = a.selected_answer == null
                    const correct = !skipped && a.selected_answer === a.correct_answer
                    return (
                      <div
                        key={a.question_id ?? idx}
                        className={`rounded-xl border p-3 ${
                          skipped ? 'bg-yellow-500/5 border-yellow-500/20'
                          : correct ? 'bg-green-500/5 border-green-500/20'
                          : 'bg-red-500/5 border-red-500/20'
                        }`}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          {skipped ? (
                            <WarningCircleIcon weight="fill" className="text-yellow-400 shrink-0 mt-0.5" size={14} />
                          ) : correct ? (
                            <CheckCircleIcon weight="fill" className="text-green-400 shrink-0 mt-0.5" size={14} />
                          ) : (
                            <XCircleIcon weight="fill" className="text-red-400 shrink-0 mt-0.5" size={14} />
                          )}
                          <p className="text-xs font-bold text-white leading-snug">
                            <span className="text-gray-500 mr-1">Q{idx + 1}.</span>
                            {a.question_text}
                          </p>
                        </div>

                        <div className="space-y-1 pl-5">
                          {(Array.isArray(a.options) ? a.options : []).map((opt: string) => {
                            const isAnswer = opt === a.correct_answer
                            const isPicked = opt === a.selected_answer
                            return (
                              <div
                                key={opt}
                                className={`text-[11px] px-2 py-1.5 rounded border flex items-center justify-between ${
                                  isAnswer
                                    ? 'bg-green-500/10 border-green-500/30 text-green-300 font-bold'
                                    : isPicked
                                    ? 'bg-red-500/10 border-red-500/30 text-red-300'
                                    : 'bg-black/30 border-white/5 text-gray-400'
                                }`}
                              >
                                <span>{opt}</span>
                                {isAnswer && <span className="text-[8px] uppercase font-black">Correct</span>}
                                {isPicked && !isAnswer && <span className="text-[8px] uppercase font-black">Your pick</span>}
                              </div>
                            )
                          })}
                        </div>

                        {a.explanation && (
                          <p className="text-[10px] text-gray-400 mt-2 pl-5 leading-relaxed">
                            <span className="font-bold text-gray-300">Why: </span>
                            {a.explanation}
                          </p>
                        )}

                        <p className="text-[9px] text-gray-500 mt-1.5 pl-5">
                          Worth {a.points} pts {correct && <span className="text-green-400 font-bold">· Earned</span>}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {/* ===================== END DETAILED REVIEW ===================== */}

          <div className="mb-6">
            <h3 className="text-[10px] font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <SwordIcon weight="fill" className="text-red-400" /> Enemy Attack Log
            </h3>
            <div className="bg-black/30 rounded-xl p-2 border border-white/5 space-y-1">
              {enemyFighters.map((f: any) => {
                const equippedBorder = f.profiles?.user_inventory?.find((inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'avatar_border')
                const borderUrl = Array.isArray(equippedBorder?.cosmetic_items) ? equippedBorder.cosmetic_items[0]?.preview_url : equippedBorder?.cosmetic_items?.preview_url

                return (
                  <div key={f.user_id} className="flex items-center justify-between p-1.5 hover:bg-white/5 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
                        <div className="absolute inset-[15%] rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-[8px] font-bold text-gray-400 z-10">
                          {f.profiles?.avatar_url ? <img src={f.profiles.avatar_url} className="w-full h-full object-cover" /> : f.profiles?.display_name?.charAt(0)}
                        </div>
                        {borderUrl && <img src={borderUrl} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />}
                      </div>
                      <span className="text-[11px] font-bold text-white">{f.profiles?.display_name}</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {f.hasAttackedToday ? (
                        <span className="text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-bold uppercase border border-green-500/30">Done</span>
                      ) : (
                        <span className="text-[8px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase border border-red-500/30 animate-pulse">Pending</span>
                      )}
                      <span className="text-[11px] font-black text-red-400 w-10 text-right">{f.war_points} pts</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <button 
            onClick={() => navigate('/clans')}
            className={`game-button w-full py-3 ${
              isWarFinished 
                ? (isDraw 
                    ? 'bg-gray-500 text-white hover:bg-gray-400' 
                    : isWin 
                    ? 'bg-[#ccff00] !text-black font-black tracking-wide hover:bg-[#b3e600] hover:!text-black shadow-[0_0_15px_rgba(204,255,0,0.2)]' 
                    : 'bg-white/10 text-white hover:bg-white/20')
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {isWarFinished 
              ? (isDraw ? 'Claim Draw & Return' : isWin ? 'Claim Victory & Return' : 'Return to Clans') 
              : 'Return to Clans (Wait for others)'} 
            <CaretLeftIcon weight="bold" />
          </button>
        </div>
      </div>
    )
  }

  // ================= ACTIVE WAR QUIZ =================
  if (!questions.length || !rulesAcknowledged) {
    return <LoadingScreen title="Preparing Battle" subtitle="Loading Quiz..." />
  }

  const currentQ = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const hasAnswered = !!answers[currentQ.id]
  const progress = ((currentIndex + 1) / questions.length) * 100
  const ts: number = warData?.team_size ?? 5

  const hasStartedQuiz = Object.keys(answers).length > 0

  return (
    <div className="game-dashboard flex flex-col">
      <header className="p-4 flex items-center justify-between border-b border-white/10 bg-[#0f1014] relative z-10">
        
        <div className="w-10 flex items-center justify-center">
          {!hasStartedQuiz ? (
            <button 
              onClick={() => navigate('/clans')}
              className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition text-gray-400 hover:text-white"
              title="Go back (No progress lost)"
            >
              <CaretLeftIcon weight="bold" size={20} />
            </button>
          ) : (
            <div title="You cannot leave once you start answering." className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 cursor-not-allowed">
              <LockIcon weight="fill" size={20} />
            </div>
          )}
        </div>

        <div className="text-center flex-1">
          <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest flex items-center justify-center gap-1 mb-1">
            <FireIcon weight="fill" /> Live Battle · {teamLabel(ts)}
          </p>
          <div className="flex items-center justify-center gap-2">
            <p className="text-sm font-black text-white">{quizMeta?.title}</p>
            
            {quizMeta?.difficulty && (
              <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase border ${
                quizMeta.difficulty === 'hard' 
                  ? 'bg-red-500/20 text-red-400 border-red-500/30' 
                  : quizMeta.difficulty === 'intermediate'
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                  : 'bg-[#ccff00]/20 text-[#ccff00] border-[#ccff00]/30'
              }`}>
                {quizMeta.difficulty}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 bg-black/50 border border-white/10 rounded-xl px-3 py-1.5">
          <TimerIcon weight="fill" className="w-4 h-4 text-[#ccff00]" />
          <span className={`font-mono font-bold text-sm ${questionTimer <= 5 ? 'text-red-400 animate-pulse' : 'text-[#ccff00]'}`}>
            {questionTimer}s
          </span>
        </div>
      </header>

      <div className="h-1 bg-white/5 relative z-10">
        <div 
          className="h-full bg-gradient-to-r from-[#ccff00] to-purple-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 max-w-2xl w-full mx-auto p-4 py-8 relative z-10 flex flex-col">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
              {currentQ.points} PTS
            </span>
          </div>
          <h1 className="text-lg md:text-xl font-bold text-white leading-tight">
            {currentQ.question_text}
          </h1>
          {currentQ.hint && (
            <p className="text-[11px] text-yellow-400/80 mt-2 italic flex items-center gap-1.5">
              <ShieldIcon weight="fill" /> Hint: {currentQ.hint}
            </p>
          )}
        </div>

        <div className="space-y-2 flex-1">
          {currentQ.options.map((opt: string, i: number) => {
            const isSelected = answers[currentQ.id] === opt
            return (
              <button
                key={i}
                onClick={() => handleSelectOption(opt)}
                disabled={isProcessingClick.current || isSubmitting}
                className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  isSelected 
                    ? 'bg-purple-500/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.3)]' 
                    : 'bg-[#0f1014] border-white/10 hover:border-white/30'
                } disabled:opacity-75 disabled:cursor-not-allowed`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs shrink-0 ${
                  isSelected ? 'bg-purple-500 text-white' : 'bg-white/10 text-gray-400'
                }`}>
                  {String.fromCharCode(65 + i)}
                </div>
                <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                  {opt}
                </span>
                {isSelected && <CheckCircleIcon weight="fill" className="w-4 h-4 text-purple-400 ml-auto" />}
              </button>
            )
          })}
        </div>

        <div className="mt-8 flex justify-center h-12 items-center">
          {isLastQuestion && (
            <p className="text-xs text-gray-400 font-bold animate-pulse flex items-center gap-2">
              {isSubmitting ? (
                <>Submitting your score...</>
              ) : (
                <>Select an answer to finish and submit.</>
              )}
            </p>
          )}
        </div>
      </main>
    </div>
  )
}