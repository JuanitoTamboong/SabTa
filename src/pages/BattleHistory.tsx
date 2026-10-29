// src/pages/BattleHistory.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SwordIcon, ArrowLeftIcon, TrophyIcon, ClockIcon, TrashIcon, XCircleIcon, WarningIcon, MinusIcon } from '@phosphor-icons/react'

export default function BattleHistory() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [battles, setBattles] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // ✅ Background State
  const [equippedBackground, setEquippedBackground] = useState<string | null>(null)

  // ✅ Custom Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean
    type: 'cancel' | 'decline' | 'delete' | null
    battleId: string | null
  }>({ isOpen: false, type: null, battleId: null })

  useEffect(() => {
    fetchBattles()
  }, [navigate])

  const fetchBattles = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return navigate('/')
    setUserId(user.id)

    // ✅ Fetch Background
    const { data: invData } = await supabase
      .from('user_inventory')
      .select('is_equipped, cosmetic_items(cosmetic_type, preview_url)')
      .eq('user_id', user.id)
      .eq('is_equipped', true)

    if (invData) {
      const bg = invData.find((i: any) => 
        i.is_equipped && 
        (i.cosmetic_items as any)?.cosmetic_type === 'background'
      )
      if (bg && (bg.cosmetic_items as any)?.preview_url) {
        setEquippedBackground((bg.cosmetic_items as any).preview_url)
      }
    }

    // Fetch Battles
    const { data, error } = await supabase
      .from('quiz_battles')
      .select(`
        *,
        quizzes ( title ),
        challenger:profiles!challenger_id ( id, display_name, avatar_url ),
        opponent:profiles!opponent_id ( id, display_name, avatar_url )
      `)
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (data) {
      setBattles(data)
    }
    setLoading(false)
  }

  const openConfirmModal = (battleId: string, type: 'cancel' | 'decline' | 'delete') => {
    setModalConfig({ isOpen: true, type, battleId })
  }

  const closeConfirmModal = () => {
    setModalConfig({ isOpen: false, type: null, battleId: null })
  }

  const confirmAction = async () => {
    if (!modalConfig.battleId) return
    
    setProcessingId(modalConfig.battleId)
    try {
      const { error } = await supabase
        .from('quiz_battles')
        .delete()
        .eq('id', modalConfig.battleId)

      if (error) throw error

      setBattles(prev => prev.filter(b => b.id !== modalConfig.battleId))
      closeConfirmModal()
    } catch (err: any) {
      alert(err.message || "Action failed.")
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">LOADING BATTLES...</div>

  return (
    <div className="min-h-screen bg-[#050505] text-white flex relative">
      
      {/* ✅ APPLIED BACKGROUND */}
      {equippedBackground && (
        <div className="fixed inset-0 z-0 pointer-events-none w-full h-full overflow-hidden">
          <img 
            src={equippedBackground} 
            alt="bg" 
            className="w-full h-full object-cover opacity-70 md:opacity-50 scale-105" 
          />
          <div className="absolute inset-0 bg-[#050505]/40 md:bg-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-transparent to-[#050505] md:bg-gradient-to-br md:from-[#050505]/90 md:via-[#050505]/50 md:to-transparent" />
        </div>
      )}

      <div className="w-full max-w-3xl mx-auto pt-4 p-4 sm:p-8 lg:p-12 relative z-10">
        
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate('/dashboard')} className="bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 p-3 rounded-xl transition shrink-0">
            <ArrowLeftIcon weight="bold" className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 drop-shadow-md">
              <SwordIcon weight="fill" className="text-[#ff00a0]" /> Battle History
            </h1>
            <p className="text-gray-400 text-sm mt-1 drop-shadow-md">View your past 1v1 challenges.</p>
          </div>
        </div>

        {/* Battle List */}
        <div className="space-y-4">
          {battles.length === 0 ? (
            <div className="text-center py-16 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl">
              <SwordIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-bold text-lg">No battles yet</p>
              <p className="text-gray-500 text-sm mt-1">Challenge someone from the Leaderboard or their Profile!</p>
            </div>
          ) : (
            battles.map((battle) => {
              const isMeChallenger = battle.challenger_id === userId
              const isMeOpponent = battle.opponent_id === userId
              
              const myScore = isMeChallenger ? battle.challenger_score : battle.opponent_score
              const theirScore = isMeChallenger ? battle.opponent_score : battle.challenger_score

              // 🔥 FIX: If the score is not null, they have played. No need for the boolean check.
              const iHavePlayed = myScore !== null && myScore !== undefined
              const theyHavePlayed = theirScore !== null && theirScore !== undefined
              
              const needsMyAction = battle.status === 'pending' && !iHavePlayed
              const canCancel = isMeChallenger && battle.status === 'pending' && !iHavePlayed
              const iAmWaiting = battle.status === 'pending' && iHavePlayed && !theyHavePlayed

              let actualWinnerId = battle.winner_id
              let isDraw = false

              if (battle.status === 'completed') {
                if (actualWinnerId === null) {
                  if (battle.challenger_score > (battle.opponent_score || 0)) {
                    actualWinnerId = battle.challenger_id
                  } else if ((battle.opponent_score || 0) > battle.challenger_score) {
                    actualWinnerId = battle.opponent_id
                  } else {
                    isDraw = true
                  }
                }
              }

              return (
                <div key={battle.id} className={`relative bg-black/40 backdrop-blur-xl border ${needsMyAction ? 'border-[#ff00a0]' : 'border-white/10'} rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all`}>
                  
                  {/* Left Side: Players & Quiz */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm sm:text-base text-white truncate">
                      {battle.quizzes?.title || "Quiz Battle"}
                    </p>
                    <p className="text-[10px] text-gray-500 mb-2">
                       {new Date(battle.created_at).toLocaleDateString()}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-400">
                      <div className="flex items-center gap-1.5 shrink-0">
                        {battle.challenger?.avatar_url ? (
                          <img src={battle.challenger.avatar_url} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px]">{battle.challenger?.display_name?.charAt(0)}</div>
                        )}
                        <span className="truncate max-w-[100px] sm:max-w-none">{battle.challenger?.display_name} {isMeChallenger && '(You)'}</span>
                      </div>
                      
                      <span className="text-[#ff00a0] font-bold shrink-0">VS</span>
                      
                      <div className="flex items-center gap-1.5 shrink-0">
                        {battle.opponent?.avatar_url ? (
                          <img src={battle.opponent.avatar_url} className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px]">{battle.opponent?.display_name?.charAt(0)}</div>
                        )}
                        <span className="truncate max-w-[100px] sm:max-w-none">{battle.opponent?.display_name} {isMeOpponent && '(You)'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Scores, Status, & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0 shrink-0">
                    
                    <div className="text-center shrink-0">
                      <p className="text-[10px] text-gray-500 uppercase font-bold">Score</p>
                      <p className="text-sm font-bold text-[#ccff00]">
                        {myScore !== null ? myScore : '-'} - {theirScore !== null ? theirScore : '-'}
                      </p>
                    </div>

                    {/* 🔥 WAITING STATE: I played, waiting for them */}
                    {iAmWaiting && (
                      <div className="flex items-center text-yellow-500 text-xs font-bold bg-yellow-500/10 px-3 py-2 rounded-lg shrink-0">
                        <ClockIcon className="mr-1.5 w-4 h-4 hidden sm:block" /> Waiting...
                      </div>
                    )}

                    {/* 🔥 YOUR TURN: Show button only if it's your turn */}
                    {needsMyAction && (
                      <button 
                        onClick={() => navigate(`/play/${battle.quiz_id}?battleId=${battle.id}&opponent=true`)}
                        className="bg-[#ff00a0] text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-xs sm:text-sm font-bold hover:bg-white hover:text-[#ff00a0] transition whitespace-nowrap shadow-[0_0_15px_rgba(255,0,160,0.3)] animate-pulse shrink-0"
                      >
                        Play Turn
                      </button>
                    )}

                    {battle.status === 'completed' && (
                      <div className={`flex items-center text-xs font-bold px-3 py-2 rounded-lg shrink-0 ${
                        actualWinnerId === userId 
                          ? 'text-[#ccff00] bg-[#ccff00]/10' 
                          : isDraw 
                            ? 'text-gray-300 bg-white/10'
                            : 'text-red-400 bg-red-500/10'
                      }`}>
                        {actualWinnerId === userId ? (
                          <><TrophyIcon className="mr-1.5 w-4 h-4 hidden sm:block" /> Victory!</>
                        ) : isDraw ? (
                          <><MinusIcon weight="bold" className="mr-1.5 w-4 h-4 hidden sm:block" /> Draw</>
                        ) : (
                          <><XCircleIcon weight="bold" className="mr-1.5 w-4 h-4 hidden sm:block" /> Defeat</>
                        )}
                      </div>
                    )}

                    {/* ✅ ACTION BUTTONS TRIGGER CUSTOM MODAL */}
                    {canCancel ? (
                      <button 
                        onClick={() => openConfirmModal(battle.id, 'cancel')}
                        disabled={processingId === battle.id}
                        className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition disabled:opacity-50 shrink-0"
                        title="Cancel Challenge"
                      >
                        <XCircleIcon weight="bold" className="w-5 h-5" />
                      </button>
                    ) : needsMyAction ? (
                      <button 
                        onClick={() => openConfirmModal(battle.id, 'decline')}
                        disabled={processingId === battle.id}
                        className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition disabled:opacity-50 shrink-0"
                        title="Decline Challenge"
                      >
                        <XCircleIcon weight="bold" className="w-5 h-5" />
                      </button>
                    ) : (!needsMyAction && !iAmWaiting && battle.status === 'completed') ? (
                      <button 
                        onClick={() => openConfirmModal(battle.id, 'delete')}
                        disabled={processingId === battle.id}
                        className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition disabled:opacity-50 shrink-0"
                        title="Delete History"
                      >
                        <TrashIcon weight="bold" className="w-5 h-5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ✅ CUSTOM CONFIRMATION MODAL */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center relative shadow-[0_0_50px_rgba(255,0,160,0.1)]">
            
            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg ${
              modalConfig.type === 'delete' ? 'bg-red-500/20 text-red-500' : 'bg-[#ff00a0]/20 text-[#ff00a0]'
            }`}>
              {modalConfig.type === 'delete' ? (
                <TrashIcon weight="fill" className="w-8 h-8 sm:w-10 sm:h-10" />
              ) : (
                <WarningIcon weight="fill" className="w-8 h-8 sm:w-10 sm:h-10" />
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              {modalConfig.type === 'delete' && 'Delete History?'}
              {modalConfig.type === 'cancel' && 'Cancel Challenge?'}
              {modalConfig.type === 'decline' && 'Decline Challenge?'}
            </h2>
            
            <p className="text-gray-400 text-sm mb-6 sm:mb-8">
              {modalConfig.type === 'delete' && 'Are you sure you want to delete this battle record? This action cannot be undone.'}
              {modalConfig.type === 'cancel' && 'Are you sure you want to cancel this challenge? The opponent will no longer see it.'}
              {modalConfig.type === 'decline' && 'Are you sure you want to decline this challenge? It will be removed from your list.'}
            </p>

            <div className="flex gap-3">
              <button 
                onClick={closeConfirmModal} 
                disabled={processingId !== null}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={confirmAction} 
                disabled={processingId !== null}
                className={`flex-1 py-3 rounded-xl font-bold transition disabled:opacity-50 text-sm shadow-lg ${
                  modalConfig.type === 'delete' 
                    ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20' 
                    : 'bg-[#ff00a0] hover:bg-white text-white hover:text-[#ff00a0] shadow-[#ff00a0]/20'
                }`}
              >
                {processingId ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}