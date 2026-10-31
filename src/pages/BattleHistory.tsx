// src/pages/BattleHistory.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  SwordIcon, ArrowLeftIcon, TrophyIcon, ClockIcon, TrashIcon,
  XCircleIcon, WarningIcon, MinusIcon, CoinsIcon, WarningCircleIcon
} from '@phosphor-icons/react'

type BattleTab = 'friendly' | 'bet'

export default function BattleHistory() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [friendlyBattles, setFriendlyBattles] = useState<any[]>([])
  const [betBattles, setBetBattles] = useState<any[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // ✅ Tab State
  const [activeTab, setActiveTab] = useState<BattleTab>('friendly')

  // ✅ Background State
  const [equippedBackground, setEquippedBackground] = useState<string | null>(null)

  // ✅ Inline alert (replaces native alert())
  const [alertData, setAlertData] = useState<{ title: string; message: string; type: 'success' | 'error' } | null>(null)

  // ✅ Custom Modal State (supports both types)
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean
    type: 'cancel' | 'decline' | 'delete' | 'cancel-bet' | 'decline-bet' | 'delete-bet' | null
    battleId: string | null
    isBet: boolean
    wager?: number
  }>({ isOpen: false, type: null, battleId: null, isBet: false })

  const fetchBattles = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return navigate('/')
    
    // We only set the user ID on initial load to avoid resetting state
    if (!userId) setUserId(user.id)

    // ✅ Fetch Background (Only on initial load)
    if (!equippedBackground) {
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
    }

    // ── Fetch FRIENDLY battles ──
    const { data: friendlyData } = await supabase
      .from('quiz_battles')
      .select(`
        *,
        quizzes ( title ),
        challenger:profiles!challenger_id ( id, display_name, avatar_url ),
        opponent:profiles!opponent_id ( id, display_name, avatar_url )
      `)
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (friendlyData) setFriendlyBattles(friendlyData)

    // ── Fetch BET battles ──
    const { data: betData } = await supabase
      .from('bet_battles')
      .select(`
        *,
        quizzes ( title ),
        challenger:profiles!challenger_id ( id, display_name, avatar_url ),
        opponent:profiles!opponent_id ( id, display_name, avatar_url )
      `)
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (betData) setBetBattles(betData)

    setLoading(false)
  }

  // 1. Initial Fetch
  useEffect(() => {
    fetchBattles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. REALTIME LISTENER
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`battle-history-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'quiz_battles' },
        () => {
          fetchBattles()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bet_battles' },
        () => {
          fetchBattles()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const openConfirmModal = (
    battleId: string,
    type: 'cancel' | 'decline' | 'delete' | 'cancel-bet' | 'decline-bet' | 'delete-bet',
    isBet: boolean,
    wager?: number
  ) => {
    setModalConfig({ isOpen: true, type, battleId, isBet, wager })
  }

  const closeConfirmModal = () => {
    setModalConfig({ isOpen: false, type: null, battleId: null, isBet: false })
  }

  const confirmAction = async () => {
    if (!modalConfig.battleId) return
    setProcessingId(modalConfig.battleId)

    try {
      const { type, battleId, isBet } = modalConfig

      if (isBet) {
        // ── BET BATTLE ACTIONS ──
        if (type === 'cancel-bet') {
          const { error } = await supabase.rpc('cancel_bet_battle', { p_battle_id: battleId })
          if (error) throw error
          setBetBattles(prev => prev.filter(b => b.id !== battleId))
        } else if (type === 'decline-bet') {
          const { error } = await supabase.rpc('decline_bet_battle', { p_battle_id: battleId })
          if (error) throw error
          setBetBattles(prev => prev.filter(b => b.id !== battleId))
        } else if (type === 'delete-bet') {
          const { error } = await supabase.from('bet_battles').delete().eq('id', battleId)
          if (error) throw error
          setBetBattles(prev => prev.filter(b => b.id !== battleId))
        }
      } else {
        // ── FRIENDLY BATTLE ACTIONS ──
        const { error } = await supabase
          .from('quiz_battles')
          .delete()
          .eq('id', battleId)
        if (error) throw error
        setFriendlyBattles(prev => prev.filter(b => b.id !== battleId))
      }

      closeConfirmModal()
    } catch (err: any) {
      setAlertData({ title: 'Action Failed', message: err.message || 'Action failed.', type: 'error' })
    } finally {
      setProcessingId(null)
    }
  }

  // Modal copy helper
  const getModalCopy = () => {
    const { type, wager } = modalConfig
    switch (type) {
      case 'delete':
        return { title: 'Delete History?', body: 'Are you sure you want to delete this battle record? This action cannot be undone.', btn: 'Delete', color: 'red' }
      case 'cancel':
        return { title: 'Cancel Challenge?', body: 'Are you sure you want to cancel this challenge? The opponent will no longer see it.', btn: 'Confirm', color: 'pink' }
      case 'decline':
        return { title: 'Decline Challenge?', body: 'Are you sure you want to decline this challenge? It will be removed from your list.', btn: 'Confirm', color: 'pink' }
      case 'cancel-bet':
        return { title: 'Cancel Bet?', body: `Cancelling this bet will refund your ${wager} coins. The opponent will no longer see it.`, btn: 'Cancel & Refund', color: 'yellow' }
      case 'decline-bet':
        return { title: 'Decline Bet?', body: `Declining will refund the challenger's ${wager} coins. Are you sure?`, btn: 'Decline & Refund', color: 'yellow' }
      case 'delete-bet':
        return { title: 'Delete Bet History?', body: 'Are you sure you want to delete this bet record? This action cannot be undone.', btn: 'Delete', color: 'red' }
      default:
        return { title: '', body: '', btn: 'Confirm', color: 'pink' }
    }
  }

  if (loading) return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">LOADING BATTLES...</div>

  // ── Render a battle card (shared for friendly + bet) ──
  const renderBattleCard = (battle: any, isBet: boolean) => {
    const isMeChallenger = battle.challenger_id === userId
    const isMeOpponent = battle.opponent_id === userId

    const myScore = isMeChallenger ? battle.challenger_score : battle.opponent_score
    const theirScore = isMeChallenger ? battle.opponent_score : battle.challenger_score

    const iHavePlayed = myScore !== null && myScore !== undefined
    const theyHavePlayed = theirScore !== null && theirScore !== undefined
    const bothPlayed = iHavePlayed && theyHavePlayed

    // Status-derived flags
    const isBetTerminal = isBet && ['declined', 'cancelled'].includes(battle.status)
    const isBetPending = isBet && battle.status === 'pending'
    const isBetAccepted = isBet && battle.status === 'accepted'
    const isCompleted = isBet
      ? battle.status === 'completed'
      : battle.status === 'completed' || bothPlayed

    // ── BET action flags (aligned with new flow) ──
    const challengerWaitingAccept = isBetPending && isMeChallenger
    const canCancelBet = challengerWaitingAccept
    const canDeclineBet = isBetPending && isMeOpponent
    const canPlayBet = isBetAccepted && !iHavePlayed
    const iAmWaitingBet = isBetAccepted && iHavePlayed && !theyHavePlayed

    // ── FRIENDLY action flags ──
    const needsMyAction = !isBet && !isCompleted && !iHavePlayed
    const canCancelFriendly = !isBet && isMeChallenger && !isCompleted && !iHavePlayed
    const iAmWaitingFriendly = !isBet && !isCompleted && iHavePlayed && !theyHavePlayed

    const borderClass = isBet
      ? isBetPending
        ? 'border-yellow-500'
        : isBetAccepted
          ? 'border-yellow-500/50'
          : isBetTerminal
            ? 'border-white/10 opacity-70'
            : 'border-white/10'
      : needsMyAction
        ? 'border-[#ff00a0]'
        : 'border-white/10'

    const renderActionButtons = () => {
      if (isBet) {
        if (canCancelBet) {
          return (
            <button
              onClick={() => openConfirmModal(battle.id, 'cancel-bet', true, battle.wager_amount)}
              disabled={processingId === battle.id}
              className="p-2 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-xl transition disabled:opacity-50 shrink-0"
              title="Cancel Bet (refund)"
            >
              <XCircleIcon weight="bold" className="w-5 h-5" />
            </button>
          )
        }
        if (canDeclineBet) {
          return (
            <button
              onClick={() => openConfirmModal(battle.id, 'decline-bet', true, battle.wager_amount)}
              disabled={processingId === battle.id}
              className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition disabled:opacity-50 shrink-0"
              title="Decline Bet (refund challenger)"
            >
              <XCircleIcon weight="bold" className="w-5 h-5" />
            </button>
          )
        }
        if (isCompleted || isBetTerminal) {
          return (
            <button
              onClick={() => openConfirmModal(battle.id, 'delete-bet', true)}
              disabled={processingId === battle.id}
              className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition disabled:opacity-50 shrink-0"
              title="Delete History"
            >
              <TrashIcon weight="bold" className="w-5 h-5" />
            </button>
          )
        }
        return null
      }

      // FRIENDLY actions
      if (canCancelFriendly) {
        return (
          <button
            onClick={() => openConfirmModal(battle.id, 'cancel', false)}
            disabled={processingId === battle.id}
            className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition disabled:opacity-50 shrink-0"
            title="Cancel Challenge"
          >
            <XCircleIcon weight="bold" className="w-5 h-5" />
          </button>
        )
      }
      if (needsMyAction) {
        return (
          <button
            onClick={() => openConfirmModal(battle.id, 'decline', false)}
            disabled={processingId === battle.id}
            className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition disabled:opacity-50 shrink-0"
            title="Decline Challenge"
          >
            <XCircleIcon weight="bold" className="w-5 h-5" />
          </button>
        )
      }
      if (isCompleted && bothPlayed) {
        return (
          <button
            onClick={() => openConfirmModal(battle.id, 'delete', false)}
            disabled={processingId === battle.id}
            className="p-2 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-xl transition disabled:opacity-50 shrink-0"
            title="Delete History"
          >
            <TrashIcon weight="bold" className="w-5 h-5" />
          </button>
        )
      }
      return null
    }

    return (
      <div
        key={battle.id}
        className={`relative bg-black/40 backdrop-blur-xl border ${borderClass} rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all`}
      >
        {/* Left Side */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-bold text-sm sm:text-base text-white truncate">
              {battle.quizzes?.title || 'Quiz Battle'}
            </p>
            {isBet && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 flex items-center gap-1 shrink-0">
                <CoinsIcon weight="fill" className="w-3 h-3" />
                {battle.wager_amount}
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mb-2">
            {new Date(battle.created_at).toLocaleDateString()}
          </p>

          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-gray-400">
            <div className="flex items-center gap-1.5 shrink-0">
              {battle.challenger?.avatar_url ? (
                <img src={battle.challenger.avatar_url} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
                  {battle.challenger?.display_name?.charAt(0)}
                </div>
              )}
              <span className="truncate max-w-[100px] sm:max-w-none">
                {battle.challenger?.display_name} {isMeChallenger && '(You)'}
              </span>
            </div>

            <span className={`font-bold shrink-0 ${isBet ? 'text-yellow-400' : 'text-[#ff00a0]'}`}>VS</span>

            <div className="flex items-center gap-1.5 shrink-0">
              {battle.opponent?.avatar_url ? (
                <img src={battle.opponent.avatar_url} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px]">
                  {battle.opponent?.display_name?.charAt(0)}
                </div>
              )}
              <span className="truncate max-w-[100px] sm:max-w-none">
                {battle.opponent?.display_name} {isMeOpponent && '(You)'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 border-white/10 pt-3 sm:pt-0 shrink-0">

          {/* ✅ SCORE / POT (Fixed to show score once played) */}
          {!(isBet && isBetTerminal) && (
            <div className="text-center shrink-0">
              <p className="text-[10px] text-gray-500 uppercase font-bold">
                {isBet && (iHavePlayed || theyHavePlayed) ? 'Score' : isBet ? 'Pot' : 'Score'}
              </p>
              
              {isBet ? (
                (iHavePlayed || theyHavePlayed) ? (
                  <p className="text-sm font-bold text-[#ccff00]">
                    {myScore !== null && myScore !== undefined ? myScore : '-'} - {theirScore !== null && theirScore !== undefined ? theirScore : '-'}
                  </p>
                ) : (
                  <p className="text-sm font-bold text-yellow-400 flex items-center justify-center gap-1">
                    {battle.wager_amount * 2} <CoinsIcon weight="fill" className="w-3 h-3" />
                  </p>
                )
              ) : (
                <p className="text-sm font-bold text-[#ccff00]">
                  {myScore !== null ? myScore : '-'} - {theirScore !== null ? theirScore : '-'}
                </p>
              )}
            </div>
          )}

          {/* BET — challenger pending → "Awaiting Accept" */}
          {challengerWaitingAccept && (
            <div className="flex items-center text-yellow-500 text-xs font-bold bg-yellow-500/10 px-3 py-2 rounded-lg shrink-0">
              <ClockIcon className="mr-1.5 w-4 h-4 hidden sm:block" /> Awaiting Accept
            </div>
          )}

          {/* BET — opponent pending → Review */}
          {isBet && isBetPending && isMeOpponent && (
            <button
              onClick={() => navigate(`/profile/${battle.challenger_id}`)}
              className="bg-yellow-500 text-black px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-yellow-400 transition whitespace-nowrap shadow-[0_0_15px_rgba(234,179,8,0.3)] shrink-0"
            >
              Review Bet
            </button>
          )}

          {/* BET — accepted + haven't played → Play Bet */}
          {canPlayBet && (
            <button
              onClick={() => navigate(`/play/${battle.quiz_id}?betBattleId=${battle.id}`)}
              className="bg-yellow-500 text-black px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-xs sm:text-sm font-bold hover:bg-yellow-400 transition whitespace-nowrap shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse shrink-0"
            >
              Play Bet
            </button>
          )}

          {/* BET — accepted + played → waiting for opponent */}
          {iAmWaitingBet && (
            <div className="flex items-center text-yellow-500 text-xs font-bold bg-yellow-500/10 px-3 py-2 rounded-lg shrink-0">
              <ClockIcon className="mr-1.5 w-4 h-4 hidden sm:block" /> Waiting...
            </div>
          )}

          {/* FRIENDLY — waiting on opponent */}
          {iAmWaitingFriendly && (
            <div className="flex items-center text-yellow-500 text-xs font-bold bg-yellow-500/10 px-3 py-2 rounded-lg shrink-0">
              <ClockIcon className="mr-1.5 w-4 h-4 hidden sm:block" /> Waiting...
            </div>
          )}

          {/* FRIENDLY — my turn */}
          {needsMyAction && (
            <button
              onClick={() => navigate(`/play/${battle.quiz_id}?battleId=${battle.id}&opponent=true`)}
              className="bg-[#ff00a0] text-white px-4 py-2 sm:px-6 sm:py-3 rounded-xl text-xs sm:text-sm font-bold hover:bg-white hover:text-[#ff00a0] transition whitespace-nowrap shadow-[0_0_15px_rgba(255,0,160,0.3)] animate-pulse shrink-0"
            >
              Play Turn
            </button>
          )}

          {/* BET — result badge */}
          {isBet && isCompleted && bothPlayed && (
            <div className={`flex items-center text-xs font-bold px-3 py-2 rounded-lg shrink-0 ${
              myScore > theirScore
                ? 'text-[#ccff00] bg-[#ccff00]/10'
                : myScore === theirScore
                  ? 'text-gray-300 bg-white/10'
                  : 'text-red-400 bg-red-500/10'
            }`}>
              {myScore > theirScore ? (
                <><TrophyIcon className="mr-1.5 w-4 h-4 hidden sm:block" /> +{battle.wager_amount} <CoinsIcon weight="fill" className="inline w-3 h-3 ml-0.5" /></>
              ) : myScore === theirScore ? (
                <><MinusIcon weight="bold" className="mr-1.5 w-4 h-4 hidden sm:block" /> Refunded</>
              ) : (
                <><XCircleIcon weight="bold" className="mr-1.5 w-4 h-4 hidden sm:block" /> -{battle.wager_amount} <CoinsIcon weight="fill" className="inline w-3 h-3 ml-0.5" /></>
              )}
            </div>
          )}

          {/* BET — declined/cancelled badge */}
          {isBet && isBetTerminal && (
            <div className="flex items-center text-xs font-bold px-3 py-2 rounded-lg shrink-0 text-gray-400 bg-white/5">
              {battle.status === 'declined' ? 'Declined' : 'Cancelled'}
            </div>
          )}

          {/* FRIENDLY — result badge */}
          {!isBet && isCompleted && bothPlayed && (
            <div className={`flex items-center text-xs font-bold px-3 py-2 rounded-lg shrink-0 ${
              myScore > theirScore
                ? 'text-[#ccff00] bg-[#ccff00]/10'
                : myScore === theirScore
                  ? 'text-gray-300 bg-white/10'
                  : 'text-red-400 bg-red-500/10'
            }`}>
              {myScore > theirScore ? (
                <><TrophyIcon className="mr-1.5 w-4 h-4 hidden sm:block" /> Victory!</>
              ) : myScore === theirScore ? (
                <><MinusIcon weight="bold" className="mr-1.5 w-4 h-4 hidden sm:block" /> Draw</>
              ) : (
                <><XCircleIcon weight="bold" className="mr-1.5 w-4 h-4 hidden sm:block" /> Defeat</>
              )}
            </div>
          )}

          {renderActionButtons()}
        </div>
      </div>
    )
  }

  const displayedBattles = activeTab === 'friendly' ? friendlyBattles : betBattles
  const modalCopy = getModalCopy()

  return (
    <div className="min-h-screen bg-[#050505] text-white flex relative">

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
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-black/40 backdrop-blur-md border border-white/10 hover:bg-white/10 p-3 rounded-xl transition shrink-0"
          >
            <ArrowLeftIcon weight="bold" className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 drop-shadow-md">
              <SwordIcon weight="fill" className="text-[#ff00a0]" /> Battle History
            </h1>
            <p className="text-gray-400 text-sm mt-1 drop-shadow-md">View your past 1v1 challenges.</p>
          </div>
        </div>

        {/* ✅ TABS */}
        <div className="grid grid-cols-2 gap-2 mb-6 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5">
          <button
            onClick={() => setActiveTab('friendly')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'friendly'
                ? 'bg-[#ff00a0] text-white shadow-[0_0_15px_rgba(255,0,160,0.3)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <SwordIcon weight="fill" className="w-4 h-4" />
            Friendly
            {friendlyBattles.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${activeTab === 'friendly' ? 'bg-black/30' : 'bg-white/10'}`}>
                {friendlyBattles.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('bet')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition ${
              activeTab === 'bet'
                ? 'bg-yellow-500 text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <CoinsIcon weight="fill" className="w-4 h-4" />
            Bet Battles
            {betBattles.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${activeTab === 'bet' ? 'bg-black/30' : 'bg-white/10'}`}>
                {betBattles.length}
              </span>
            )}
          </button>
        </div>

        {/* Battle List */}
        <div className="space-y-4">
          {displayedBattles.length === 0 ? (
            <div className="text-center py-16 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl">
              {activeTab === 'friendly' ? (
                <>
                  <SwordIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold text-lg">No friendly battles yet</p>
                  <p className="text-gray-500 text-sm mt-1">Challenge someone from the Leaderboard or their Profile!</p>
                </>
              ) : (
                <>
                  <CoinsIcon weight="duotone" className="w-16 h-16 text-yellow-500/50 mx-auto mb-4" />
                  <p className="text-gray-400 font-bold text-lg">No bet battles yet</p>
                  <p className="text-gray-500 text-sm mt-1">Wager coins on a quiz from someone's Profile!</p>
                </>
              )}
            </div>
          ) : (
            displayedBattles.map(battle => renderBattleCard(battle, activeTab === 'bet'))
          )}
        </div>
      </div>

      {/* ✅ CUSTOM CONFIRMATION MODAL */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`bg-[#0f1014] border rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center relative ${
            modalCopy.color === 'yellow' ? 'border-yellow-500/30 shadow-[0_0_50px_rgba(234,179,8,0.15)]'
            : modalCopy.color === 'red' ? 'border-red-500/30 shadow-[0_0_50px_rgba(239,68,68,0.15)]'
            : 'border-white/10 shadow-[0_0_50px_rgba(255,0,160,0.1)]'
          }`}>

            <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg ${
              modalCopy.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400'
              : modalCopy.color === 'red' ? 'bg-red-500/20 text-red-500'
              : 'bg-[#ff00a0]/20 text-[#ff00a0]'
            }`}>
              {modalCopy.color === 'red' ? (
                <TrashIcon weight="fill" className="w-8 h-8 sm:w-10 sm:h-10" />
              ) : modalCopy.color === 'yellow' ? (
                <CoinsIcon weight="fill" className="w-8 h-8 sm:w-10 sm:h-10" />
              ) : (
                <WarningIcon weight="fill" className="w-8 h-8 sm:w-10 sm:h-10" />
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              {modalCopy.title}
            </h2>

            <p className="text-gray-400 text-sm mb-6 sm:mb-8">
              {modalCopy.body}
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
                  modalCopy.color === 'red'
                    ? 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/20'
                    : modalCopy.color === 'yellow'
                      ? 'bg-yellow-500 hover:bg-yellow-400 text-black shadow-yellow-500/20'
                      : 'bg-[#ff00a0] hover:bg-white text-white hover:text-[#ff00a0] shadow-[#ff00a0]/20'
                }`}
              >
                {processingId ? 'Processing...' : modalCopy.btn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ INLINE ALERT MODAL */}
      {alertData && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 max-w-xs w-full text-center relative shadow-2xl animate-in zoom-in-95">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              alertData.type === 'success' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-500'
            }`}>
              {alertData.type === 'success' ? (
                <CoinsIcon weight="fill" className="w-8 h-8" />
              ) : (
                <WarningCircleIcon weight="fill" className="w-8 h-8" />
              )}
            </div>
            
            <h2 className="text-xl font-black text-white mb-2">{alertData.title}</h2>
            <p className="text-gray-400 text-sm mb-6">{alertData.message}</p>
            
            <button
              onClick={() => setAlertData(null)}
              className={`w-full py-3 rounded-xl font-bold text-sm transition shadow-lg ${
                alertData.type === 'success' 
                  ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-500/20' 
                  : 'bg-red-500 text-white hover:bg-red-400 shadow-red-500/20'
              }`}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  )
}