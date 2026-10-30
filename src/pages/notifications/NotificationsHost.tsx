// src/pages/notifications/NotificationsHost.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  CoinsIcon,
  SwordIcon,
  WarningCircleIcon,
  SparkleIcon,
  XIcon,
  FireIcon,
  TargetIcon,
  GiftIcon,
  LightningIcon,
  XCircleIcon,
} from '@phosphor-icons/react'
import { useNotifications } from './NotificationsProvider'

export default function NotificationsHost() {
  const navigate = useNavigate()
  const {
    profile,
    setProfile,
    incomingBattles,
    setIncomingBattles,
    incomingBetBattles,
    setIncomingBetBattles,
    showStreakModal,
    setShowStreakModal,
    streakReward,
    showDailyBonusModal,
    setShowDailyBonusModal,
    showNewContentBanner,
    newContentCount,
    dismissNewContent,
    alertData,
    setAlertData,
  } = useNotifications()

  const [declineModal, setDeclineModal] = useState<{
    isOpen: boolean
    battleId: string | null
  }>({ isOpen: false, battleId: null })
  const [declining, setDeclining] = useState(false)

  const [betDeclineModal, setBetDeclineModal] = useState<{
    isOpen: boolean
    battleId: string | null
    wager: number
  }>({ isOpen: false, battleId: null, wager: 0 })
  const [betDeclining, setBetDeclining] = useState(false)

  const openDeclineModal = (battleId: string) => {
    setDeclineModal({ isOpen: true, battleId })
  }

  const confirmDecline = async () => {
    if (!declineModal.battleId) return
    setDeclining(true)
    try {
      const { error } = await supabase
        .from('quiz_battles')
        .delete()
        .eq('id', declineModal.battleId)
      if (error) throw error
      setIncomingBattles((prev) =>
        prev.filter((b) => b.id !== declineModal.battleId)
      )
      setDeclineModal({ isOpen: false, battleId: null })
    } catch (err: any) {
      setAlertData({
        title: 'Decline Failed',
        message: err.message || 'Failed to decline challenge.',
        type: 'error',
      })
    } finally {
      setDeclining(false)
    }
  }

  const handleAcceptBattle = (battleId: string, quizId: string) => {
    setIncomingBattles((prev) => prev.filter((b) => b.id !== battleId))
    navigate(`/play/${quizId}?battleId=${battleId}&opponent=true`)
  }

  const openBetDeclineModal = (battleId: string, wager: number) => {
    setBetDeclineModal({ isOpen: true, battleId, wager })
  }

  const handleAcceptBetBattle = async (battle: any) => {
    setIncomingBetBattles((prev) => prev.filter((b) => b.id !== battle.id))
    try {
      const { error } = await supabase.rpc('accept_bet_battle', {
        p_battle_id: battle.id,
      })
      if (error) throw error

      setProfile((p: any) =>
        p ? { ...p, coins: (p.coins || 0) - battle.wager_amount } : p
      )

      navigate(`/play/${battle.quiz_id}?betBattleId=${battle.id}`)
    } catch (err: any) {
      console.error(err)
      setIncomingBetBattles((prev) => [battle, ...prev])
      setAlertData({
        title: 'Accept Failed',
        message: err.message || 'Failed to accept bet battle.',
        type: 'error',
      })
    }
  }

  const confirmBetDecline = async () => {
    if (!betDeclineModal.battleId) return
    setBetDeclining(true)
    
    // ✅ Optimistically remove the banner immediately
    const battleIdToRemove = betDeclineModal.battleId
    setIncomingBetBattles((prev) =>
      prev.filter((b) => b.id !== battleIdToRemove)
    )

    try {
      const { error } = await supabase.rpc('decline_bet_battle', {
        p_battle_id: battleIdToRemove,
      })
      if (error) throw error
      
      setBetDeclineModal({ isOpen: false, battleId: null, wager: 0 })
    } catch (err: any) {
      console.error(err)
      setAlertData({
        title: 'Decline Failed',
        message: err.message || 'Failed to decline bet battle.',
        type: 'error',
      })
      
      // Restore the banner if it failed
      if (profile?.id) {
        const { data } = await supabase
          .from('bet_battles')
          .select(`id, quiz_id, challenger_id, wager_amount, profiles!challenger_id ( display_name, avatar_url )`)
          .eq('opponent_id', profile.id)
          .eq('status', 'pending')
        
        if (data) setIncomingBetBattles(data)
      }
    } finally {
      setBetDeclining(false)
    }
  }

  return (
    <>
      {/* NEW CONTENT BANNER (Mobile Optimized) */}
      {showNewContentBanner && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[90] w-[92%] sm:w-full max-w-2xl bg-gradient-to-r from-[#00f0ff]/20 to-[#00f0ff]/5 border border-[#00f0ff]/40 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[0_0_15px_rgba(0,240,255,0.15)] animate-in slide-in-from-top-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#00f0ff]/20 p-2 rounded-xl shrink-0">
              <SparkleIcon weight="fill" className="w-5 h-5 text-[#00f0ff]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                New Content Available!
              </h3>
              <p className="text-xs text-gray-300">
                <span className="font-bold text-[#00f0ff]">
                  {newContentCount} new items
                </span>{' '}
                have been added for your tier.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <button
              onClick={() => {
                dismissNewContent()
                navigate('/rewards')
              }}
              className="flex-1 sm:flex-none bg-[#00f0ff] text-black px-4 py-2 rounded-xl text-xs font-bold hover:bg-white transition"
            >
              Check it out
            </button>
            <button
              onClick={dismissNewContent}
              className="p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition"
            >
              <XIcon weight="bold" className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* COMBINED BATTLE BANNERS (Mobile Optimized) */}
      {(incomingBattles.length > 0 || incomingBetBattles.length > 0) && (
        <div className="fixed top-4 right-4 z-[80] w-[92%] sm:w-[calc(100%-2rem)] max-w-md max-h-[80vh] overflow-y-auto space-y-3 pb-4">
          {incomingBattles.map((battle) => (
            <div
              key={battle.id}
              className="bg-[#0f1014]/95 backdrop-blur-xl bg-gradient-to-r from-[#ff00a0]/20 to-[#ff00a0]/5 border border-[#ff00a0]/40 p-4 rounded-2xl flex flex-col gap-3 shadow-[0_0_20px_rgba(255,0,160,0.25)] animate-in slide-in-from-right-4"
            >
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-[#ff00a0] shrink-0">
                  {battle.profiles?.avatar_url ? (
                    <img
                      src={battle.profiles.avatar_url}
                      alt="Challenger"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#ff00a0]/20 flex items-center justify-center text-[#ff00a0] font-bold">
                      {battle.profiles?.display_name?.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                    <SwordIcon weight="fill" className="text-[#ff00a0]" />
                    Incoming Challenge!
                  </h3>
                  <p className="text-xs text-gray-300 truncate">
                    <span className="font-bold text-white">
                      {battle.profiles?.display_name}
                    </span>{' '}
                    challenged you.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openDeclineModal(battle.id)}
                  className="flex-1 bg-white/10 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 hover:text-red-400 transition"
                >
                  Decline
                </button>
                <button
                  onClick={() =>
                    handleAcceptBattle(battle.id, battle.quiz_id)
                  }
                  className="flex-1 bg-[#ff00a0] text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-white hover:text-[#ff00a0] transition shadow-lg"
                >
                  Accept & Play
                </button>
              </div>
            </div>
          ))}

          {incomingBetBattles.map((battle) => {
            const canAfford = (profile?.coins || 0) >= battle.wager_amount
            return (
              <div
                key={battle.id}
                className="bg-[#0f1014]/95 backdrop-blur-xl bg-gradient-to-r from-yellow-500/20 to-yellow-500/5 border border-yellow-500/40 p-4 rounded-2xl flex flex-col gap-3 shadow-[0_0_20px_rgba(234,179,8,0.25)] animate-in slide-in-from-right-4"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-yellow-500 shrink-0">
                    {battle.profiles?.avatar_url ? (
                      <img
                        src={battle.profiles.avatar_url}
                        alt="Challenger"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-yellow-500/20 flex items-center justify-center text-yellow-400 font-bold">
                        {battle.profiles?.display_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-white text-sm flex items-center gap-1.5">
                      <CoinsIcon weight="fill" className="text-yellow-400" />
                      Bet Challenge!
                    </h3>
                    <p className="text-xs text-gray-300 truncate">
                      <span className="font-bold text-white">
                        {battle.profiles?.display_name}
                      </span>{' '}
                      wagered{' '}
                      <span className="font-black text-yellow-400">
                        {battle.wager_amount} coins
                      </span>
                    </p>
                    {!canAfford && (
                      <p className="text-[10px] text-red-400 font-bold mt-1 flex items-center gap-1">
                        <WarningCircleIcon weight="fill" /> Not enough coins
                        (need {battle.wager_amount})
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      openBetDeclineModal(battle.id, battle.wager_amount)
                    }
                    className="flex-1 bg-white/10 text-white px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-500/20 hover:text-red-400 transition"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => handleAcceptBetBattle(battle)}
                    disabled={!canAfford}
                    className="flex-1 bg-yellow-500 text-black px-3 py-2 rounded-xl text-xs font-bold hover:bg-yellow-400 transition shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                  >
                    <CoinsIcon weight="fill" className="w-3.5 h-3.5" />
                    Accept ({battle.wager_amount})
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* DAILY STREAK REWARD MODAL (Mobile Optimized) */}
      {showStreakModal && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-[#ff00a0]/30 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 max-w-sm w-full text-center relative shadow-[0_0_50px_rgba(255,0,160,0.2)] max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#ff00a0] to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-[0_0_40px_rgba(255,0,160,0.4)] animate-bounce">
              <FireIcon
                weight="fill"
                className="w-10 h-10 sm:w-12 sm:h-12 text-black"
              />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
              Daily Streak!
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">
              You logged in today! Keep it up to earn bigger rewards.
            </p>
            <div className="bg-black/40 border border-white/10 rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
              <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase font-bold mb-1">
                Current Streak
              </p>
              <p className="text-3xl sm:text-4xl font-bold text-[#ff00a0] flex items-center justify-center gap-2">
                {streakReward.newStreak}{' '}
                <span className="text-base sm:text-lg text-white">Days</span>
              </p>
            </div>
            <div className="bg-[#ccff00]/10 border border-[#ccff00]/30 rounded-2xl p-3 sm:p-4 flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-2">
                <GiftIcon
                  weight="fill"
                  className="text-[#ccff00] w-5 h-5 sm:w-6 sm:h-6"
                />
                <span className="font-bold text-white text-xs sm:text-sm">
                  Daily Reward
                </span>
              </div>
              <span className="font-bold text-[#ff00a0] flex items-center gap-1 text-sm sm:text-base">
                <CoinsIcon weight="fill" /> +{streakReward.coins}
              </span>
            </div>
            <button
              onClick={() => setShowStreakModal(false)}
              className="w-full bg-[#ccff00] text-black py-3 sm:py-4 rounded-xl font-black text-base sm:text-lg hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)]"
            >
              Claim & Continue
            </button>
          </div>
        </div>
      )}

      {/* DAILY CHALLENGE REWARD MODAL (Mobile Optimized) */}
      {showDailyBonusModal && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-[#ccff00]/30 rounded-3xl sm:rounded-[2rem] p-6 sm:p-8 max-w-sm w-full text-center relative shadow-[0_0_50px_rgba(204,255,0,0.2)] max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-[#ccff00] to-yellow-400 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-[0_0_40px_rgba(204,255,0,0.4)] animate-bounce">
              <TargetIcon
                weight="fill"
                className="w-10 h-10 sm:w-12 sm:h-12 text-black"
              />
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">
              Daily Challenge!
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">
              You completed 3 quizzes today! Here is your bonus reward.
            </p>
            <div className="bg-[#ccff00]/10 border border-[#ccff00]/30 rounded-2xl p-3 sm:p-4 flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-2">
                <GiftIcon
                  weight="fill"
                  className="text-[#ccff00] w-5 h-5 sm:w-6 sm:h-6"
                />
                <span className="font-bold text-white text-xs sm:text-sm">
                  Challenge Reward
                </span>
              </div>
              <div className="flex gap-3">
                <span className="font-bold text-[#ccff00] flex items-center gap-1 text-sm sm:text-base">
                  <LightningIcon weight="fill" /> +25
                </span>
                <span className="font-bold text-[#ff00a0] flex items-center gap-1 text-sm sm:text-base">
                  <CoinsIcon weight="fill" /> +50
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowDailyBonusModal(false)}
              className="w-full bg-[#ccff00] text-black py-3 sm:py-4 rounded-xl font-black text-base sm:text-lg hover:bg-white transition shadow-[0_0_20px_rgba(204,255,0,0.3)]"
            >
              Claim Rewards
            </button>
          </div>
        </div>
      )}

      {/* FRIENDLY DECLINE MODAL */}
      {declineModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center relative shadow-[0_0_50px_rgba(255,0,160,0.1)] max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg bg-[#ff00a0]/20 text-[#ff00a0]">
              <XCircleIcon
                weight="fill"
                className="w-8 h-8 sm:w-10 sm:h-10"
              />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Decline Challenge?
            </h2>
            <p className="text-gray-400 text-sm mb-6 sm:mb-8">
              Are you sure you want to decline this challenge? It will be
              removed from your list.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setDeclineModal({ isOpen: false, battleId: null })
                }
                disabled={declining}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDecline}
                disabled={declining}
                className="flex-1 py-3 rounded-xl font-bold transition disabled:opacity-50 text-sm shadow-lg bg-[#ff00a0] hover:bg-white text-white hover:text-[#ff00a0] shadow-[#ff00a0]/20"
              >
                {declining ? 'Processing...' : 'Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BET DECLINE MODAL */}
      {betDeclineModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-yellow-500/30 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center relative shadow-[0_0_50px_rgba(234,179,8,0.15)] max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg bg-yellow-500/20 text-yellow-400">
              <CoinsIcon weight="fill" className="w-8 h-8 sm:w-10 sm:h-10" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Decline Bet Battle?
            </h2>
            <p className="text-gray-400 text-sm mb-6 sm:mb-8">
              Declining will refund the challenger's{' '}
              <span className="font-bold text-yellow-400">
                {betDeclineModal.wager} coins
              </span>
              . Are you sure?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setBetDeclineModal({
                    isOpen: false,
                    battleId: null,
                    wager: 0,
                  })
                }
                disabled={betDeclining}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmBetDecline}
                disabled={betDeclining}
                className="flex-1 py-3 rounded-xl font-bold transition disabled:opacity-50 text-sm shadow-lg bg-yellow-500 hover:bg-yellow-400 text-black"
              >
                {betDeclining ? 'Processing...' : 'Decline & Refund'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INLINE ALERT MODAL */}
      {alertData && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 max-w-xs w-full text-center relative shadow-2xl animate-in zoom-in-95">
            <div
              className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                alertData.type === 'success'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-500'
              }`}
            >
              {alertData.type === 'success' ? (
                <CoinsIcon weight="fill" className="w-8 h-8" />
              ) : (
                <WarningCircleIcon weight="fill" className="w-8 h-8" />
              )}
            </div>
            <h2 className="text-xl font-black text-white mb-2">
              {alertData.title}
            </h2>
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
    </>
  )
}