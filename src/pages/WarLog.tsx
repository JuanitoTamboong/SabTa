// src/pages/WarLog.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import { 
  CaretLeftIcon, TrophyIcon, 
  CalendarBlankIcon, ClockIcon, CaretRightIcon, ListDashesIcon,
  ScalesIcon, CaretLeft, CaretRight, SwordIcon,
  TrashIcon, WarningCircleIcon
} from '@phosphor-icons/react'
import { useNotifications } from './notifications/NotificationsProvider'
import '../css/UserDashboard.css'

export default function WarLog() {
  const navigate = useNavigate()
  const { profile } = useNotifications()
  const [loading, setLoading] = useState(true)
  const [wars, setWars] = useState<any[]>([])
  const [filter, setFilter] = useState<'all' | 'won' | 'lost' | 'draw'>('all')
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  // Deletion state
  const [deleteWarId, setDeleteWarId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const fetchWars = async () => {
      if (!profile?.clan_id) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('clan_wars')
        .select(`
          id, clan_a_id, clan_b_id, winner_clan_id, ends_at, status,
          clan_a:clan_a_id (id, name, tag, avatar_url),
          clan_b:clan_b_id (id, name, tag, avatar_url)
        `)
        .eq('status', 'completed')
        .or(`clan_a_id.eq.${profile.clan_id},clan_b_id.eq.${profile.clan_id}`)
        .order('ends_at', { ascending: false })

      if (error) {
        console.error(error)
        setLoading(false)
        return
      }

      const warIds = data.map(w => w.id)
      let scoresMap: Record<string, { a: number, b: number }> = {}

      if (warIds.length > 0) {
        const { data: attacks } = await supabase
          .from('clan_war_attacks')
          .select('war_id, clan_id, points')
          .in('war_id', warIds)

        attacks?.forEach((attack: any) => {
          if (!scoresMap[attack.war_id]) scoresMap[attack.war_id] = { a: 0, b: 0 }
          const war = data.find(w => w.id === attack.war_id)
          if (war) {
            if (attack.clan_id === war.clan_a_id) scoresMap[attack.war_id].a += attack.points
            if (attack.clan_id === war.clan_b_id) scoresMap[attack.war_id].b += attack.points
          }
        })
      }

      const processed = data.map(w => {
        const isClanA = w.clan_a_id === profile.clan_id
        
        const myClan: any = isClanA ? w.clan_a : w.clan_b
        const enemyClan: any = isClanA ? w.clan_b : w.clan_a
        
        const scores = scoresMap[w.id] || { a: 0, b: 0 }
        const myScore = isClanA ? scores.a : scores.b
        const enemyScore = isClanA ? scores.b : scores.a

        let outcome: 'won' | 'lost' | 'draw' = 'draw'
        if (w.winner_clan_id === myClan?.id) {
          outcome = 'won'
        } else if (w.winner_clan_id === enemyClan?.id) {
          outcome = 'lost'
        }
        
        return {
          id: w.id,
          myClan,
          enemyClan,
          myScore,
          enemyScore,
          outcome,
          date: new Date(w.ends_at),
        }
      })

      setWars(processed)
      setLoading(false)
    }

    fetchWars()
  }, [profile?.clan_id])

  const handleDeleteWar = async () => {
    if (!deleteWarId) return
    setIsDeleting(true)

    const { error } = await supabase
      .from('clan_wars')
      .delete()
      .eq('id', deleteWarId)

    setIsDeleting(false)
    setDeleteWarId(null)

    if (error) {
      alert("Failed to delete war log: " + error.message)
      return
    }

    setWars(prev => prev.filter(w => w.id !== deleteWarId))
  }

  if (loading) return <LoadingScreen title="Loading War Log" subtitle="Fetching past battles..." />

  const filteredWars = wars.filter(w => filter === 'all' || w.outcome === filter)
  const totalPages = Math.ceil(filteredWars.length / itemsPerPage)
  const currentWars = filteredWars.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="game-dashboard flex-col">
      <div className="game-dashboard__ambient" aria-hidden="true" />
      
      <main className="game-main !w-full !ml-0">
        {/* Topbar with ONLY the back button */}
        <header className="game-topbar px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/clans')}
              className="flex items-center gap-1.5 text-gray-400 hover:text-white transition font-bold text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg"
            >
              <CaretLeftIcon weight="bold" size={16} /> Back to Clans
            </button>
          </div>
          
          <div className="game-topbar__crumb hidden md:flex">
            <span>PLAYER HUB</span><i>/</i> CLAN ARENA <i>/</i> WAR LOG
          </div>
          
          <div className="game-topbar__right"></div>
        </header>

        <div className="game-content max-w-[900px] mx-auto px-4 md:px-8">
          
          {/* Header Area with Filters */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 mt-4">
            <div>
              <span className="game-kicker"><TrophyIcon weight="fill" /> WAR HISTORY</span>
              <h1 className="text-2xl font-black text-white mt-1">Clan War Log</h1>
              <p className="text-xs text-gray-400 mt-1">Review your past clan battles and outcomes.</p>
            </div>
            
            {/* Filter Buttons - Responsive Grid */}
            <div className="grid grid-cols-4 md:flex items-center gap-1.5 bg-[#121821] border border-[rgba(207,225,238,0.09)] p-1.5 rounded-xl w-full md:w-auto">
              <button 
                onClick={() => { setFilter('all'); setCurrentPage(1); }}
                className={`justify-center px-2 md:px-3 py-2 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition flex items-center gap-1.5 ${
                  filter === 'all' ? 'bg-[#d3ff45] !text-black shadow-[0_0_12px_rgba(211,255,69,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ListDashesIcon weight="bold" /> All
              </button>
              <button 
                onClick={() => { setFilter('won'); setCurrentPage(1); }}
                className={`justify-center px-2 md:px-3 py-2 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition flex items-center gap-1.5 ${
                  filter === 'won' ? 'bg-[#d3ff45] !text-black shadow-[0_0_12px_rgba(211,255,69,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <TrophyIcon weight="bold" /> Won
              </button>
              <button 
                onClick={() => { setFilter('lost'); setCurrentPage(1); }}
                className={`justify-center px-2 md:px-3 py-2 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition flex items-center gap-1.5 ${
                  filter === 'lost' ? 'bg-[#d3ff45] !text-black shadow-[0_0_12px_rgba(211,255,69,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <SwordIcon weight="bold" /> Lost
              </button>
              <button 
                onClick={() => { setFilter('draw'); setCurrentPage(1); }}
                className={`justify-center px-2 md:px-3 py-2 md:py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition flex items-center gap-1.5 ${
                  filter === 'draw' ? 'bg-[#d3ff45] !text-black shadow-[0_0_12px_rgba(211,255,69,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <ScalesIcon weight="bold" /> Draw
              </button>
            </div>
          </div>

          {/* War List */}
          <div className="space-y-3 md:space-y-4">
            {currentWars.length === 0 ? (
              <div className="text-center py-16 bg-[#10151d] border border-[#2a3441] rounded-2xl">
                <p className="text-gray-400 font-bold text-sm">No wars found for this filter.</p>
              </div>
            ) : (
              currentWars.map((war) => (
                <div 
                  key={war.id} 
                  className="bg-[#10151d] border border-[#2a3441] rounded-xl md:rounded-2xl transition-all duration-200 hover:border-[#4a5b6c] shadow-lg group overflow-hidden"
                >
                  {/* Mobile View (Stacked) / Desktop View (Horizontal) */}
                  <div className="flex flex-col md:flex-row items-stretch">
                    
                    {/* 1. Matchup Section (Clans & Score) */}
                    <div className="flex-1 flex items-center justify-between p-4 md:p-5 relative">
                      
                      {/* My Clan */}
                      <div className="flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-3 w-[35%] md:w-[30%]">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#0a0418] border border-purple-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                          {war.myClan?.avatar_url ? (
                            <img src={war.myClan.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-purple-400 font-bold text-sm">{war.myClan?.tag || '?'}</span>
                          )}
                        </div>
                        <div className="text-center md:text-left min-w-0">
                          <p className="text-[8px] md:text-[9px] text-purple-400 font-bold uppercase tracking-widest mb-0.5">My Clan</p>
                          <h3 className="text-xs md:text-sm font-black text-white leading-tight truncate">{war.myClan?.name || 'Unknown'}</h3>
                        </div>
                      </div>

                      {/* Score & Outcome */}
                      <div className="flex flex-col items-center justify-center w-[30%] md:w-[40%] shrink-0">
                        <div className="flex items-center gap-2 md:gap-3">
                          <div className={`w-10 md:w-12 py-1 md:py-1.5 text-center rounded-lg text-lg md:text-xl font-black ${
                            war.outcome === 'won' ? 'bg-[#172011] text-[#d3ff45] border border-[#d3ff45]/30' : 'bg-[#1a2230] text-white border border-[#2a3441]'
                          }`}>
                            {war.myScore}
                          </div>
                          <span className="text-[9px] md:text-[10px] text-gray-500 font-black uppercase tracking-widest">vs</span>
                          <div className={`w-10 md:w-12 py-1 md:py-1.5 text-center rounded-lg text-lg md:text-xl font-black ${
                            war.outcome === 'lost' ? 'bg-[#261114] text-[#ff8282] border border-red-500/30' : 'bg-[#1a2230] text-white border border-[#2a3441]'
                          }`}>
                            {war.enemyScore}
                          </div>
                        </div>
                        
                        <div className="mt-1.5 md:mt-2">
                          {war.outcome === 'won' && (
                            <span className="text-[9px] md:text-[10px] text-green-400 font-black uppercase tracking-widest flex items-center gap-1">
                              <TrophyIcon weight="fill"/> Victory
                            </span>
                          )}
                          {war.outcome === 'lost' && (
                            <span className="text-[9px] md:text-[10px] text-red-400 font-black uppercase tracking-widest flex items-center gap-1">
                              <SwordIcon weight="fill"/> Defeat
                            </span>
                          )}
                          {war.outcome === 'draw' && (
                            <span className="text-[9px] md:text-[10px] text-gray-400 font-black uppercase tracking-widest flex items-center gap-1">
                              <ScalesIcon weight="fill"/> Draw
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Enemy Clan */}
                      <div className="flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-3 w-[35%] md:w-[30%] justify-end md:justify-end text-center md:text-right">
                        <div className="text-center md:text-right order-2 md:order-1 min-w-0">
                          <p className="text-[8px] md:text-[9px] text-red-400 font-bold uppercase tracking-widest mb-0.5">Enemy</p>
                          <h3 className="text-xs md:text-sm font-black text-white leading-tight truncate">{war.enemyClan?.name || 'Unknown'}</h3>
                        </div>
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-[#0a0418] border border-red-500/30 flex items-center justify-center overflow-hidden shrink-0 shadow-lg order-1 md:order-2">
                          {war.enemyClan?.avatar_url ? (
                            <img src={war.enemyClan.avatar_url} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-red-400 font-bold text-sm">{war.enemyClan?.tag || '?'}</span>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* 2. Action Section (Date, Delete, Details) */}
                    <div className="flex md:flex-col items-center md:items-end justify-between px-4 pb-4 pt-3 md:p-4 border-t md:border-t-0 md:border-l border-[#2a3441] bg-black/20 md:bg-transparent md:w-[220px] shrink-0">
                      
                      <div className="flex md:flex-col items-center md:items-end gap-3 md:gap-1">
                        <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1.5">
                          <CalendarBlankIcon weight="bold" /> {war.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-gray-500 font-medium flex items-center gap-1.5">
                          <ClockIcon weight="bold" /> {war.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setDeleteWarId(war.id)}
                          className="bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:border-red-500 p-2 rounded-lg transition"
                          title="Delete War Log"
                        >
                          <TrashIcon weight="bold" size={16} />
                        </button>
                        <button 
                          onClick={() => navigate(`/war/${war.id}`)}
                          className="bg-[#1a2230] border border-[#2a3441] text-white hover:bg-[#d3ff45] hover:text-black hover:border-[#d3ff45] px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          Details <CaretRightIcon weight="bold" />
                        </button>
                      </div>

                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8 mb-4">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 flex items-center justify-center bg-[#10151d] border border-[#2a3441] rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition"
              >
                <CaretLeft weight="bold" />
              </button>
              
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-bold transition ${
                    currentPage === i + 1 
                      ? 'bg-[#d3ff45] !text-black shadow-[0_0_10px_rgba(211,255,69,0.3)]' 
                      : 'bg-[#10151d] border border-[#2a3441] text-gray-400 hover:text-white'
                  }`}
                >
                  {i + 1}
                </button>
              ))}

              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 flex items-center justify-center bg-[#10151d] border border-[#2a3441] rounded-lg text-gray-400 hover:text-white disabled:opacity-40 transition"
              >
                <CaretRight weight="bold" />
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteWarId && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#10151d] border border-red-500/30 rounded-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 shadow-[0_0_50px_rgba(239,68,68,0.15)]">
            <div className="p-6 text-center">
              <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <WarningCircleIcon weight="fill" className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Delete War Log?</h2>
              <p className="text-sm text-gray-400">
                Are you sure you want to permanently delete this war log? This will remove all stats and history for this battle. This action cannot be undone.
              </p>
            </div>
            <div className="p-4 border-t border-white/10 bg-black/20 flex gap-3">
              <button 
                onClick={() => setDeleteWarId(null)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white font-bold text-xs transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleDeleteWar}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 rounded-xl text-white font-bold text-xs transition disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Log'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}