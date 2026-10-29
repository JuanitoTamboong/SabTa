// src/pages/PlayerProfile.tsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  UserPlusIcon, UserCheckIcon, ArrowLeftIcon, 
  TrophyIcon, LightningIcon, MedalIcon, TargetIcon, XIcon, ClockIcon, 
  PaletteIcon, ImageIcon, StarIcon, FireIcon 
} from '@phosphor-icons/react'

export default function PlayerProfile() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  
  const [loading, setLoading] = useState(true)
  const [myProfile, setMyProfile] = useState<any>(null)
  const [player, setPlayer] = useState<any>(null)
  
  // Follow State
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFollowedByThem, setIsFollowedByThem] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  const isMutual = isFollowing && isFollowedByThem
  const needsFollowBack = !isFollowing && isFollowedByThem

  // PvP State
  const [showChallengeModal, setShowChallengeModal] = useState(false)
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([])
  const [creatingBattle, setCreatingBattle] = useState(false)
  const [existingPendingBattle, setExistingPendingBattle] = useState<any>(null)
  const [hasAlreadyPlayed, setHasAlreadyPlayed] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')
      if (user.id === playerId) return navigate('/profile')

      // 1. Fetch my profile
      const { data: me } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setMyProfile(me)

      // 2. Fetch target player's profile & ALL inventory items
      const { data: target } = await supabase
        .from('profiles')
        .select(`*, user_inventory ( is_equipped, cosmetic_items ( name, preview_url, cosmetic_type, rarity ) )`)
        .eq('id', playerId)
        .single()
      
      setPlayer(target)

      // 3. Check BOTH follow directions in parallel
      const [myFollow, theirFollow] = await Promise.all([
        supabase.from('follows').select('id').eq('follower_id', user.id).eq('following_id', playerId).maybeSingle(),
        supabase.from('follows').select('id').eq('follower_id', playerId).eq('following_id', user.id).maybeSingle(),
      ])

      setIsFollowing(!!myFollow.data)
      setIsFollowedByThem(!!theirFollow.data)

      // 4. Check for any valid pending battles
      const { data: pending } = await supabase
        .from('quiz_battles')
        .select('id, quiz_id, challenger_id, opponent_id, challenger_score, opponent_score, quizzes(title)')
        .or(`and(challenger_id.eq.${user.id},opponent_id.eq.${playerId}),and(challenger_id.eq.${playerId},opponent_id.eq.${user.id})`)
        .eq('status', 'pending')
        .limit(1)
        .maybeSingle()

      // Ignore if DB lagged and both already played
      if (pending && (pending.challenger_score !== null && pending.opponent_score !== null)) {
         // Battle is actually done, ignore it
      } else if (pending) {
        setExistingPendingBattle(pending)
        
        const isMeChallenger = pending.challenger_id === user.id
        const myScore = isMeChallenger ? pending.challenger_score : pending.opponent_score
        
        if (myScore !== null && myScore !== undefined) {
          setHasAlreadyPlayed(true)
        }
      }

      setLoading(false)
    }
    fetchData()
  }, [playerId, navigate])

  const handleFollow = async () => {
    if (!myProfile || followLoading) return
    setFollowLoading(true)
    
    try {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', myProfile.id).eq('following_id', playerId)
        setIsFollowing(false)
      } else {
        await supabase.from('follows').insert({ follower_id: myProfile.id, following_id: playerId })
        setIsFollowing(true)
      }
    } catch (err) {
      console.error(err)
      alert('Action failed.')
    } finally {
      setFollowLoading(false)
    }
  }

  const openChallengeModal = async () => {
    setShowChallengeModal(true)
    const { data } = await supabase
      .from('quizzes')
      .select('id, title, category, difficulty')
      .eq('age_category', myProfile.age_category)
      .eq('status', 'published')
    
    if (data) setAvailableQuizzes(data)
  }

  const handleCreateBattle = async (quizId: string) => {
    setCreatingBattle(true)
    try {
      const { data, error } = await supabase.from('quiz_battles').insert({
        challenger_id: myProfile.id,
        opponent_id: playerId,
        quiz_id: quizId,
        challenger_score: null,
        challenger_submitted: false
      }).select().single()

      if (error) throw error
      navigate(`/play/${quizId}?battleId=${data.id}`)
    } catch (err) {
      console.error(err)
      alert('Failed to create battle.')
      setCreatingBattle(false)
    }
  }

  const handleResumeBattle = () => {
    if (existingPendingBattle) {
      navigate(`/play/${existingPendingBattle.quiz_id}?battleId=${existingPendingBattle.id}&opponent=true`)
    }
  }

  const followButtonLabel = isMutual ? 'Friends' : needsFollowBack ? 'Follow Back' : isFollowing ? 'Following' : 'Add Friend'
  const followButtonIcon = isMutual ? <UserCheckIcon weight="fill" /> : needsFollowBack ? <UserPlusIcon weight="bold" /> : isFollowing ? <UserCheckIcon weight="bold" /> : <UserPlusIcon weight="bold" />

  if (loading) return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center font-mono">LOADING PROFILE...</div>
  if (!player) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">Player not found.</div>

  const allInventory = player.user_inventory || []
  const equippedItems = allInventory.filter((i: any) => i.is_equipped)
  
  const equippedBorder = equippedItems.find((i: any) => i.cosmetic_items?.cosmetic_type === 'avatar_border')
  const equippedBg = equippedItems.find((i: any) => i.cosmetic_items?.cosmetic_type === 'background')
  const equippedTheme = equippedItems.find((i: any) => i.cosmetic_items?.cosmetic_type === 'quiz_theme')

  const totalThemes = allInventory.filter((i: any) => i.cosmetic_items?.cosmetic_type === 'quiz_theme').length
  const totalBgs = allInventory.filter((i: any) => i.cosmetic_items?.cosmetic_type === 'background').length
  const totalBorders = allInventory.filter((i: any) => i.cosmetic_items?.cosmetic_type === 'avatar_border').length

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center p-3 sm:p-6 relative">
      
      {equippedBg?.cosmetic_items?.preview_url && (
        <div className="fixed inset-0 z-0 pointer-events-none w-full h-full overflow-hidden">
          <img src={equippedBg.cosmetic_items.preview_url} className="w-full h-full object-cover opacity-60 md:opacity-40 scale-105" />
          <div className="absolute inset-0 bg-[#050505]/60 md:bg-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/40 to-[#050505]" />
        </div>
      )}

      <div className="w-full max-w-3xl relative z-10 pt-2">
        <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white bg-black/40 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10 transition text-sm">
          <ArrowLeftIcon weight="bold" className="w-4 h-4" /> Back
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-6">
          
          <div className="md:col-span-7 bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-5 sm:p-8 text-center shadow-2xl relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-[#00f0ff]/10 to-transparent pointer-events-none" />

            <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-4 flex items-center justify-center">
              <div className="absolute inset-[12%] rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-3xl font-bold uppercase shadow-inner">
                {player.avatar_url ? (
                  <img src={player.avatar_url} className="w-full h-full object-cover" />
                ) : (
                  player.display_name?.charAt(0)
                )}
              </div>
              {equippedBorder?.cosmetic_items?.preview_url && (
                <img src={equippedBorder.cosmetic_items.preview_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-md" />
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white mb-1 tracking-tight">{player.display_name}</h1>
            <span className="inline-block text-[#ccff00] font-mono text-[10px] sm:text-xs bg-[#ccff00]/10 px-3 py-1 rounded-full border border-[#ccff00]/20 mb-3">
              {player.age_category?.toUpperCase()} TIER
            </span>

            <div className="mb-6 min-h-[20px]">
              {isMutual && (
                <p className="text-xs text-[#ccff00] font-bold flex items-center justify-center gap-1.5">
                  <UserCheckIcon weight="fill" className="w-4 h-4" /> You are connected
                </p>
              )}
              {needsFollowBack && (
                <p className="text-xs text-[#ccff00] font-bold flex items-center justify-center gap-1.5">
                  <LightningIcon weight="fill" className="w-4 h-4" /> Follows you
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button 
                onClick={handleFollow}
                disabled={followLoading}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 ${
                  isFollowing 
                    ? 'bg-white/10 text-white hover:bg-white/20' 
                    : 'bg-[#ccff00] text-black hover:bg-white shadow-[0_0_15px_rgba(204,255,0,0.2)]'
                }`}
              >
                {followButtonIcon} {followButtonLabel}
              </button>

              {existingPendingBattle ? (
                hasAlreadyPlayed ? (
                  <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 cursor-not-allowed">
                    <ClockIcon weight="bold" className="w-4 h-4" /> Waiting for Opponent
                  </div>
                ) : (
                  <button 
                    onClick={handleResumeBattle}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-yellow-500 text-black hover:bg-yellow-400 transition shadow-[0_0_15px_rgba(234,179,8,0.3)] animate-pulse"
                  >
                    <ClockIcon weight="bold" className="w-4 h-4" /> Resume Battle
                  </button>
                )
              ) : (
                <button 
                  onClick={openChallengeModal}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#ff00a0] text-white hover:bg-white hover:text-[#ff00a0] transition shadow-[0_0_15px_rgba(255,0,160,0.3)]"
                >
                  <TargetIcon weight="bold" className="w-4 h-4" /> Challenge
                </button>
              )}
            </div>
          </div>

          <div className="md:col-span-5 space-y-4 sm:space-y-6">
            
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between relative overflow-hidden">
                <div className="absolute top-0 right-0 w-12 h-12 bg-[#ccff00]/10 rounded-bl-full" />
                <div>
                  <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider mb-0.5">Total Points</p>
                  <p className="text-2xl font-black text-[#ccff00]">{player.points}</p>
                </div>
                <LightningIcon weight="fill" className="text-[#ccff00] w-8 h-8 opacity-50" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center">
                  <FireIcon weight="fill" className="text-[#ff00a0] w-5 h-5 mb-1" />
                  <p className="text-xl font-bold">{player.current_streak}</p>
                  <p className="text-[9px] text-gray-400 uppercase font-bold">Streak</p>
                </div>
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center">
                  <MedalIcon weight="fill" className="text-[#00f0ff] w-5 h-5 mb-1" />
                  <p className="text-xl font-bold">{Math.floor(player.points / 100) + 1}</p>
                  <p className="text-[9px] text-gray-400 uppercase font-bold">Level</p>
                </div>
              </div>
            </div>

            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-4">
              <h3 className="text-xs font-bold text-white mb-3 flex items-center gap-2">
                <StarIcon weight="fill" className="text-[#ccff00]" /> Equipped Cosmetics
              </h3>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    {equippedTheme?.cosmetic_items?.preview_url ? (
                      <img src={equippedTheme.cosmetic_items.preview_url} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <PaletteIcon weight="fill" className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] text-gray-500 uppercase font-bold">Quiz Theme</p>
                      <span className="text-[8px] font-bold text-[#ccff00] bg-[#ccff00]/10 px-1.5 py-0.5 rounded border border-[#ccff00]/20">
                        {totalThemes} Owned
                      </span>
                    </div>
                    <p className="text-[11px] font-bold truncate">{equippedTheme?.cosmetic_items?.name || 'Default Theme'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    {equippedBg?.cosmetic_items?.preview_url ? (
                      <img src={equippedBg.cosmetic_items.preview_url} className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <ImageIcon weight="fill" className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] text-gray-500 uppercase font-bold">Background</p>
                      <span className="text-[8px] font-bold text-[#ccff00] bg-[#ccff00]/10 px-1.5 py-0.5 rounded border border-[#ccff00]/20">
                        {totalBgs} Owned
                      </span>
                    </div>
                    <p className="text-[11px] font-bold truncate">{equippedBg?.cosmetic_items?.name || 'Default Background'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    {equippedBorder?.cosmetic_items?.preview_url ? (
                      <img src={equippedBorder.cosmetic_items.preview_url} className="w-full h-full object-contain p-0.5" />
                    ) : (
                      <TrophyIcon weight="fill" className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[8px] text-gray-500 uppercase font-bold">Avatar Border</p>
                      <span className="text-[8px] font-bold text-[#ccff00] bg-[#ccff00]/10 px-1.5 py-0.5 rounded border border-[#ccff00]/20">
                        {totalBorders} Owned
                      </span>
                    </div>
                    <p className="text-[11px] font-bold truncate">{equippedBorder?.cosmetic_items?.name || 'Default Border'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showChallengeModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-5 sm:p-6 max-w-sm w-full relative shadow-2xl">
            
            <button 
              onClick={() => setShowChallengeModal(false)} 
              className="absolute top-3 right-3 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition"
            >
              <XIcon weight="bold" className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-black mb-1">Challenge {player.display_name}</h2>
            <p className="text-gray-400 text-xs mb-4">Pick a quiz. You play first, then they have to beat your score!</p>
            
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-hide">
              {availableQuizzes.length === 0 ? (
                <div className="text-center py-6 bg-black/40 rounded-xl border border-white/5">
                  <TargetIcon weight="duotone" className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-xs font-bold">No quizzes available for your tier.</p>
                </div>
              ) : (
                availableQuizzes.map(q => (
                  <button 
                    key={q.id} 
                    onClick={() => handleCreateBattle(q.id)}
                    disabled={creatingBattle}
                    className="w-full text-left bg-black/40 border border-white/10 rounded-xl p-3 hover:border-[#ccff00]/50 hover:bg-[#ccff00]/5 transition group flex justify-between items-center disabled:opacity-50"
                  >
                    <div className="pr-2">
                      <p className="font-bold text-sm text-white group-hover:text-[#ccff00] transition">{q.title}</p>
                      <p className="text-[10px] text-gray-400">{q.category}</p>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded border shrink-0 ${
                      q.difficulty === 'hard' ? 'text-red-400 border-red-500/30 bg-red-500/10' : 
                      q.difficulty === 'intermediate' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : 
                      'text-green-400 border-green-500/30 bg-green-500/10'
                    }`}>{q.difficulty}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}