// src/pages/notifications/SeasonEndModal.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from './NotificationsProvider'
import {
  TrophyIcon,
  CoinsIcon,
  CrownIcon,
  SparkleIcon,
  CaretRightIcon,
  MedalIcon,
} from '@phosphor-icons/react'

// 🔧 FIXED: Add Interface so TypeScript knows 'border_url' exists
interface SeasonPlayer {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  border_url?: string | null;
  final_points: number;
  reward_coins: number;
}

const RANK_STYLES = [
  {
    border: 'border-[#ffd700]/60',
    glow: 'shadow-[0_0_40px_rgba(255,215,0,0.35)]',
    badgeBg: 'bg-gradient-to-br from-[#ffd700] to-[#ff9500]',
    text: 'text-[#ffd700]',
    ring: 'ring-[#ffd700]/40',
    label: '#1',
  },
  {
    border: 'border-[#c0c0c0]/60',
    glow: 'shadow-[0_0_30px_rgba(192,192,192,0.3)]',
    badgeBg: 'bg-gradient-to-br from-[#e8e8e8] to-[#a0a0a0]',
    text: 'text-[#e0e0e0]',
    ring: 'ring-[#c0c0c0]/40',
    label: '#2',
  },
  {
    border: 'border-[#cd7f32]/60',
    glow: 'shadow-[0_0_30px_rgba(205,127,50,0.3)]',
    badgeBg: 'bg-gradient-to-br from-[#e8a86b] to-[#8b5a2b]',
    text: 'text-[#e8a86b]',
    ring: 'ring-[#cd7f32]/40',
    label: '#3',
  },
]

export default function SeasonEndModal() {
  const navigate = useNavigate()
  const { seasonAnnouncement, dismissSeasonAnnouncement } = useNotifications()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (seasonAnnouncement) {
      // Small delay so it doesn't flash on first paint
      const t = setTimeout(() => setVisible(true), 150)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
    }
  }, [seasonAnnouncement])

  if (!seasonAnnouncement) return null

  // 🔧 SAFETY: Filter out duplicates just in case the database sends them
  const uniquePlayers = (seasonAnnouncement.topPlayers as SeasonPlayer[]).filter(
    (player, index, self) => index === self.findIndex((p) => p.user_id === player.user_id)
  )
  const top3 = uniquePlayers.slice(0, 3)
  
  // Dynamically grab the season number from the announcement data
  const currentSeason = seasonAnnouncement.seasonNumber

  const handleClose = async () => {
    setVisible(false)
    await dismissSeasonAnnouncement()
  }

  const handleViewLeaderboard = async () => {
    await handleClose()
    navigate('/leaderboard')
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={handleClose}
      />

      {/* Confetti-ish glows */}
      <div className="absolute top-10 left-10 w-72 h-72 bg-[#ffd700]/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-[#ff00a0]/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />

      {/* Card */}
      <div
        className={`relative w-full max-w-lg bg-[#0a0a0a]/95 border border-[#ffd700]/30 rounded-3xl overflow-hidden transition-all duration-500 ${
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
      >
        {/* Top banner */}
        <div className="relative bg-gradient-to-br from-[#ffd700]/25 via-[#ff00a0]/15 to-transparent px-6 pt-8 pb-6 text-center border-b border-white/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,215,0,0.25),transparent_70%)]" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#ffd700] to-[#ff9500] flex items-center justify-center mb-3 shadow-[0_0_30px_rgba(255,215,0,0.5)]">
              <CrownIcon weight="fill" className="w-9 h-9 text-black" />
            </div>
            
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#ffd700]/80 mb-1">
              Season {currentSeason} · Final Results
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Season <span className="text-[#ffd700]">{currentSeason}</span> Has Ended!
            </h2>
            <p className="text-gray-400 text-xs sm:text-sm mt-2 max-w-xs">
              Congratulations to our Top 3 global players — massive coin rewards have been granted.
            </p>
          </div>
        </div>

        {/* Top 3 list */}
        <div className="px-5 py-5 space-y-2.5">
          {top3.map((player, idx) => {
            const style = RANK_STYLES[idx] ?? RANK_STYLES[2]
            return (
              <div
                key={player.user_id}
                className={`flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border ${style.border} ${style.glow}`}
              >
                {/* 🔧 FIXED AVATAR & BORDER CONTAINER */}
                <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                  {/* Inner Avatar Circle */}
                  <div
                    className={`w-[75%] h-[75%] rounded-full overflow-hidden ${style.badgeBg} flex items-center justify-center z-10`}
                  >
                    {player.avatar_url ? (
                      <img
                        src={player.avatar_url}
                        alt={player.display_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-black text-black text-lg uppercase">
                        {player.display_name?.charAt(0) || '?'}
                      </span>
                    )}
                  </div>
                  
                  {/* 🔧 EQUIPPED BORDER OVERLAY */}
                  {player.border_url && (
                    <img 
                      src={player.border_url} 
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" 
                      alt="border" 
                    />
                  )}

                  {/* Rank Badge */}
                  <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black border border-white/20 flex items-center justify-center z-30">
                    {idx === 0 ? (
                      <CrownIcon weight="fill" className="w-3 h-3 text-[#ffd700]" />
                    ) : (
                      <MedalIcon weight="fill" className={`w-3 h-3 ${style.text}`} />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black ${style.text}`}>
                      {style.label}
                    </span>
                    <p className="font-bold text-sm truncate text-white">
                      {player.display_name}
                    </p>
                  </div>
                  <p className="text-[10px] text-gray-500 font-semibold">
                    {player.final_points.toLocaleString()} pts
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="flex items-center gap-1 text-[#ff00a0] font-black text-sm">
                    <CoinsIcon weight="fill" className="w-3.5 h-3.5" />
                    +{player.reward_coins.toLocaleString()}
                  </div>
                  <p className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider">
                    coins
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-1 space-y-2">
          <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2">
            <SparkleIcon weight="fill" className="w-3.5 h-3.5 text-[#00f0ff]" />
            
            {/* Dynamic Next Season Number */}
            <span>
              <span className="font-bold text-white">Season {currentSeason + 1}</span> is live — points reset to 0.
              Good luck!
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleViewLeaderboard}
              className="flex-1 flex items-center justify-center gap-1.5 bg-[#ccff00] hover:bg-white text-black font-bold py-3 rounded-xl transition text-sm"
            >
              <TrophyIcon weight="fill" className="w-4 h-4" />
              Leaderboard
            </button>
            <button
              onClick={handleClose}
              className="flex-1 flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold py-3 rounded-xl transition text-sm"
            >
              Got it <CaretRightIcon weight="bold" className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}