// src/pages/notifications/WarRewardModal.tsx
import { CoinsIcon, TrophyIcon, StarIcon, XIcon, CheckCircleIcon, SwordIcon, ShieldIcon, SparkleIcon } from '@phosphor-icons/react'
import { useNotifications } from './NotificationsProvider'

type Reward = {
  war_id: string
  ends_at: string
  winner_clan_id: string | null
  clan_a_id?: string | null
  clan_b_id?: string | null
  winner_clan: { name: string; tag: string; avatar_url?: string } | null
  loser_clan: { name: string; tag: string; avatar_url?: string } | null
  prizes: {
    coins: number
    points: number
    cosmetics: { id: string; name: string; preview_url: string; cosmetic_type: string }[]
  } | null
}

export default function WarRewardModal({ 
  reward, 
  onDismiss 
}: { 
  reward: Reward; 
  onDismiss: () => void 
}) {
  const { profile } = useNotifications()
  
  const myClanId = profile?.clan_id
  const myClanName = profile?.clan?.name || profile?.clan_name

  let isWinner = false
  let isDraw = false

  const winnerName = reward.winner_clan?.name

  if (reward.winner_clan_id && myClanId) {
    isWinner = reward.winner_clan_id === myClanId
  } else if (winnerName && myClanName) {
    isWinner = winnerName === myClanName
  } else if (!reward.winner_clan_id && !winnerName) {
    isDraw = true
  }

  const displayCoins = reward.prizes?.coins || 0
  const displayPoints = reward.prizes?.points || 0
  const displayCosmetics = reward.prizes?.cosmetics || []

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-4">
      <div className={`bg-[#0f1014] border ${
        isWinner ? 'border-[#ccff00]/40 shadow-[0_0_50px_rgba(204,255,0,0.15)]' : 
        isDraw ? 'border-gray-500/40 shadow-[0_0_50px_rgba(156,163,175,0.15)]' :
        'border-[#00f0ff]/40 shadow-[0_0_50px_rgba(0,240,255,0.15)]'
      } rounded-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 max-h-[90vh]`}>
        
        {/* Header */}
        <div className={`relative p-5 text-center bg-gradient-to-b shrink-0 ${
          isWinner ? 'from-[#ccff00]/20 border-[#ccff00]/20' : 
          isDraw ? 'from-gray-500/20 border-gray-500/20' :
          'from-[#00f0ff]/20 border-[#00f0ff]/20'
        } to-transparent border-b`}>
          <button onClick={onDismiss} className="absolute top-3 right-3 p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition">
            <XIcon weight="bold" size={14} />
          </button>
          
          <div className={`mx-auto w-16 h-16 bg-gradient-to-br ${
            isWinner ? 'from-[#ccff00] to-yellow-400' : 
            isDraw ? 'from-gray-400 to-gray-600' :
            'from-[#00f0ff] to-blue-500'
          } rounded-full flex items-center justify-center mb-2 shadow-lg ${isWinner ? 'animate-bounce' : ''}`}>
            {isDraw ? <ShieldIcon weight="fill" className="w-8 h-8 text-black" /> : <TrophyIcon weight="fill" className="w-8 h-8 text-black" />}
          </div>
          
          <span className={`text-[9px] font-bold ${
            isWinner ? 'text-[#ccff00]' : 
            isDraw ? 'text-gray-400' :
            'text-[#00f0ff]'
          } uppercase tracking-widest flex items-center justify-center gap-1.5`}>
            {isWinner ? 'Clan War Result' : isDraw ? 'Clan War Result' : <><SparkleIcon weight="fill"/> War Announcement <SparkleIcon weight="fill"/></>}
          </span>
          
          <h2 className="text-xl font-black text-white mt-0.5">
            {isWinner ? 'CONGRATULATIONS!' : isDraw ? 'DRAW' : 'VICTORY'}
          </h2>
          
          {/* Matchup Details */}
          <div className="bg-black/40 rounded-xl p-2 mt-3 border border-white/5">
            {isDraw ? (
              <p className="text-xs font-bold text-gray-300">Both clans fought to a standstill.</p>
            ) : (
              <>
                <p className={`text-xs font-bold ${isWinner ? 'text-[#ccff00]' : 'text-white'}`}>
                  {reward.winner_clan?.name || 'Winner'}
                </p>
                <p className="text-[8px] text-gray-500 uppercase font-bold flex items-center justify-center gap-1.5 my-0.5">
                  <SwordIcon weight="fill" className="text-red-400" /> Defeated <SwordIcon weight="fill" className="text-red-400" />
                </p>
                <p className="text-xs font-bold text-gray-400 line-through decoration-red-500/50">
                  {reward.loser_clan?.name || 'Loser'}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto admin-custom-scrollbar space-y-3">
          
          {/* Section Title */}
          <div className="flex items-center justify-center gap-1.5">
            {isWinner ? (
              <p className="text-[9px] text-[#ccff00] uppercase font-bold tracking-wider">Your Spoils of War</p>
            ) : isDraw ? (
               <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider">No Spoils Claimed</p>
            ) : (
              <p className="text-[9px] text-[#00f0ff] uppercase font-bold tracking-wider flex items-center gap-1.5">
                <TrophyIcon weight="fill" /> Winner's Spoils
              </p>
            )}
          </div>

          {(!isDraw && (displayCoins > 0 || displayPoints > 0)) || (!isDraw && displayCosmetics.length > 0) ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {displayCoins > 0 && (
                  <div className={`bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center ${!isWinner && 'bg-opacity-20'}`}>
                    <CoinsIcon weight="fill" className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
                    <p className="text-xl font-black text-yellow-300">{displayCoins}</p>
                    <p className="text-[8px] text-yellow-400/70 uppercase font-bold">Coins</p>
                  </div>
                )}
                {displayPoints > 0 && (
                  <div className={`bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-center ${!isWinner && 'bg-opacity-20'}`}>
                    <StarIcon weight="fill" className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                    <p className="text-xl font-black text-purple-300">{displayPoints}</p>
                    <p className="text-[8px] text-purple-400/70 uppercase font-bold">Points</p>
                  </div>
                )}
              </div>

              {displayCosmetics.length > 0 && (
                <div className={`bg-black/30 border border-white/5 rounded-xl p-2.5 ${!isWinner && 'bg-opacity-20'}`}>
                  <p className="text-[9px] text-gray-500 uppercase font-bold mb-2 text-center">Cosmetics Awarded</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {displayCosmetics.map((c) => (
                      <div key={c.id} className="flex flex-col items-center gap-1 w-16">
                        <div className={`w-10 h-10 rounded-lg overflow-hidden bg-black/60 flex items-center justify-center ${c.cosmetic_type === 'avatar_border' ? 'rounded-full ring-2 ring-[#00f0ff]/50' : ''}`}>
                          <img src={c.preview_url} alt={c.name} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[8px] text-white font-bold text-center leading-tight truncate w-full">{c.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : isDraw ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-gray-400">Neither clan claimed victory. No rewards were distributed.</p>
            </div>
          ) : null}

          {/* Footer Message */}
          <div className={`rounded-lg p-2.5 flex items-start gap-2 ${
            isWinner ? 'bg-[#ccff00]/10 border border-[#ccff00]/20' : 
            isDraw ? 'bg-gray-500/10 border border-gray-500/20' :
            'bg-[#00f0ff]/10 border border-[#00f0ff]/20'
          }`}>
            <CheckCircleIcon weight="fill" className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
              isWinner ? 'text-[#ccff00]' : 
              isDraw ? 'text-gray-400' :
              'text-[#00f0ff]'
            }`} />
            <p className="text-[9px] text-gray-300 leading-tight">
              {isWinner 
                ? 'Your clan won! These rewards have been added directly to your account.' 
                : isDraw
                ? 'The war ended in a tie. Prepare for the next battle!'
                : `A powerful display of strength by ${reward.winner_clan?.name || 'the enemy clan'}! Your clan fought hard.`}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-black/40 shrink-0">
          <button onClick={onDismiss} className={`w-full font-black py-2.5 rounded-lg transition text-xs ${
            isWinner 
              ? 'bg-[#ccff00] hover:bg-white text-black shadow-[0_0_15px_rgba(204,255,0,0.3)]' 
              : isDraw
              ? 'bg-gray-500 hover:bg-gray-400 text-white'
              : 'bg-[#00f0ff] hover:bg-white text-black shadow-[0_0_15px_rgba(0,240,255,0.3)]'
          }`}>
            {isWinner ? 'Claim Rewards' : isDraw ? 'Acknowledge Draw' : 'Acknowledge'}
          </button>
        </div>
      </div>
    </div>
  )
}