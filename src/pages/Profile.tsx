// src/pages/Profile.tsx
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  UserIcon, SignOutIcon, HouseIcon, GameControllerIcon, TrophyIcon, ShoppingBagIcon,
  LightningIcon, CheckCircleIcon, PencilSimpleIcon, FloppyDiskIcon, 
  CalendarBlankIcon, TargetIcon, CoinsIcon, MedalIcon, StarIcon, CheckIcon,
  CameraIcon, UsersIcon, CaretRightIcon, UserPlusIcon, UserMinusIcon,
  ShieldIcon // 👈 ADDED ShieldIcon
} from '@phosphor-icons/react'
import { fetchAllBadges, getPlayerBadge, type BadgeInfo } from '../lib/badges'
import sabtaLogo from '../assets/icons/sabta-logo.png'

export default function Profile() {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [equipping, setEquipping] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  
  // 🔧 Badge State
  const [allBadges, setAllBadges] = useState<BadgeInfo[]>([])

  // Edit State
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')

  // Data State
  const [history, setHistory] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'history' | 'inventory' | 'friends'>('inventory')

  // ✅ Friends State
  const [followers, setFollowers] = useState<any[]>([])
  const [following, setFollowing] = useState<any[]>([])
  const [friendTab, setFriendTab] = useState<'followers' | 'following'>('followers')
  const [followBackLoading, setFollowBackLoading] = useState<string | null>(null)
  const [unfollowLoading, setUnfollowLoading] = useState<string | null>(null)

  // Stats State
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    bestScore: 0,
    accuracy: 0,
    totalCoinsEarned: 0,
  })

  useEffect(() => {
    const fetchProfileData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')

      // 🔧 Fetch Badges
      const badgesData = await fetchAllBadges()
      setAllBadges(badgesData)

      // 1. Fetch Profile first
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (profileData) {
        setProfile(profileData)
        setEditName(profileData.display_name || '')
      }

      // Priority: uploaded avatar > Google avatar > none
      const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
      setAvatarUrl(profileData?.avatar_url || googleAvatar || null)

      // 2. Fetch History & Stats
      const { data: attempts } = await supabase.from('quiz_attempts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      if (attempts) {
        setHistory(attempts)
        const totalQuizzes = attempts.length
        const bestScore = totalQuizzes > 0 ? Math.max(...attempts.map(a => a.score)) : 0
        
        const totalCorrect = attempts.reduce((acc, curr) => acc + curr.correct_answers, 0)
        const totalQuestionsAttempted = attempts.reduce((acc, curr) => acc + (curr.correct_answers + curr.incorrect_answers + curr.unanswered_questions), 0)
        const avgAccuracy = totalQuestionsAttempted > 0 ? (totalCorrect / totalQuestionsAttempted) * 100 : 0
        
        const totalCoinsEarned = attempts.reduce((acc, curr) => acc + (curr.correct_answers * 150), 0)

        setStats({ totalQuizzes, bestScore, accuracy: Math.round(avgAccuracy), totalCoinsEarned })
      }

      // 3. Fetch Inventory
      const { data: invData } = await supabase
        .from('user_inventory')
        .select('*, cosmetic_items(*)')
        .eq('user_id', user.id)
      
      if (invData) {
        setInventory(invData.filter(i => i.cosmetic_items !== null))
      }

      // ✅ 4. Fetch Friends
      await refreshFriends(user.id)

      setLoading(false)
    }

    fetchProfileData()
  }, [navigate])

  // ✅ Function to fetch fresh data from DB and normalize relations
  const refreshFriends = async (userId: string) => {
    const { data: followersData } = await supabase
      .from('follows')
           .select(`
        follower_id, 
        profiles!follower_id!inner (
          id, display_name, avatar_url, points, role,
          user_inventory!user_id ( is_equipped, cosmetic_items ( preview_url, cosmetic_type ) )
        )
      `)
      .eq('following_id', userId)
      .eq('profiles.role', 'player')

    const { data: followingData } = await supabase
      .from('follows')
      .select(`
        following_id, 
        profiles!following_id (
          id, display_name, avatar_url, points,
          user_inventory!user_id ( is_equipped, cosmetic_items ( preview_url, cosmetic_type ) )
        )
      `)
      .eq('follower_id', userId)

    const normalizeProfile = (p: any) => Array.isArray(p) ? p[0] : p;

    const validFollowing = (followingData || []).filter(f => normalizeProfile(f.profiles) !== null);
    const followingIds = new Set(validFollowing.map(f => normalizeProfile(f.profiles).id));

    const enrichedFollowers = (followersData || [])
      .map(f => {
        const profile = normalizeProfile(f.profiles);
        if (!profile) return null;
        const isMutual = followingIds.has(profile.id);
        return { ...f, profiles: profile, isMutual };
      })
      .filter(f => f !== null && f.isMutual === false); 

    setFollowers(enrichedFollowers)
    setFollowing(validFollowing)
  }

  // ✅ Follow back from the Followers tab
  const handleFollowBack = async (targetId: string, targetProfile: any) => {
    if (!profile || followBackLoading) return
    setFollowBackLoading(targetId)
    try {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: profile.id, following_id: targetId })
      
      if (error && error.code !== '23505') throw error
      await refreshFriends(profile.id)
    } catch (err: any) {
      alert(err.message || 'Failed to follow back.')
    } finally {
      setFollowBackLoading(null)
    }
  }

  // ✅ Unfollow from the Following tab
  const handleUnfollow = async (targetId: string) => {
    if (!profile || unfollowLoading) return
    setUnfollowLoading(targetId)
    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', profile.id)
        .eq('following_id', targetId)
      
      if (error) throw error
      await refreshFriends(profile.id)
    } catch (err: any) {
      alert(err.message || 'Failed to unfollow.')
    } finally {
      setUnfollowLoading(null)
    }
  }

  const handleUpdateName = async () => {
    if (!editName.trim() || editName === profile.display_name) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles').update({ display_name: editName }).eq('id', profile.id)
      if (error) throw error
      setProfile({ ...profile, display_name: editName })
      setIsEditing(false)
    } catch (err) {
      alert("Failed to update name.")
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !profile) return

    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.')
      return
    }

    setUploadingAvatar(true)
    try {
      const compressedFile = await new Promise<File>((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 500;
          let width = img.width;
          let height = img.height;

          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error("Canvas not supported"));
          
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const newFileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                const newFile = new File([blob], newFileName, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                URL.revokeObjectURL(img.src);
                resolve(newFile);
              } else {
                reject(new Error("Compression failed"));
              }
            },
            'image/jpeg',
            0.8
          );
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(img.src);
          reject(err);
        };
      });

      if (avatarUrl && avatarUrl.includes('/storage/v1/object/public/avatars/')) {
        const oldFilePath = avatarUrl.split('/avatars/')[1]
        if (oldFilePath) {
          await supabase.storage.from('avatars').remove([oldFilePath])
        }
      }

      const fileExt = compressedFile.name.split('.').pop() || 'jpg'
      const filePath = `${profile.id}/avatar-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, compressedFile, { upsert: true, contentType: compressedFile.type })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError

      setAvatarUrl(publicUrl)
      setProfile({ ...profile, avatar_url: publicUrl })
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Upload failed.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleEquip = async (itemId: string) => {
    if (equipping) return
    setEquipping(true)
    try {
      const { error } = await supabase.rpc('equip_cosmetic', { p_item_id: itemId })
      if (error) throw error

      const targetItem = inventory.find(i => i.cosmetic_item_id === itemId);
      const isCurrentlyEquipped = targetItem?.is_equipped;
      const itemType = targetItem?.cosmetic_items?.cosmetic_type;

      const updatedInventory = inventory.map(invItem => {
        if (isCurrentlyEquipped) {
          if (invItem.cosmetic_item_id === itemId) {
            return { ...invItem, is_equipped: false }
          }
          return invItem;
        } 
        
        if (invItem.cosmetic_items?.cosmetic_type === itemType) {
          return { ...invItem, is_equipped: invItem.cosmetic_item_id === itemId }
        }
        
        return invItem;
      })
      
      setInventory(updatedInventory)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setEquipping(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const categorizedInventory = inventory.reduce((acc, item) => {
    const type = item.cosmetic_items?.cosmetic_type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  const categoryLabels: Record<string, string> = {
    avatar_border: 'Avatar Borders',
    background: 'Profile Backgrounds',
    quiz_theme: 'Quiz Themes',
    other: 'Other Items'
  };

  if (loading) {
    return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">LOADING PROFILE...</div>
  }

  const equippedBorder = inventory.find(i => i.is_equipped && i.cosmetic_items?.cosmetic_type === 'avatar_border')
  const equippedBackground = inventory.find(i => i.is_equipped && i.cosmetic_items?.cosmetic_type === 'background')

  // 🔧 Get Current Badge
  const currentBadge = getPlayerBadge(profile?.points || 0, allBadges)

  return (
    <div className="min-h-screen bg-[#050505] text-white flex relative">
      
      {/* BACKGROUND */}
      {equippedBackground?.cosmetic_items?.preview_url && (
        <div className="fixed inset-0 z-0 pointer-events-none w-full h-full overflow-hidden">
          <img src={equippedBackground.cosmetic_items.preview_url} alt="bg" className="w-full h-full object-cover opacity-70 md:opacity-50 scale-105" />
          <div className="absolute inset-0 bg-[#050505]/40 md:bg-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-transparent to-[#050505] md:bg-gradient-to-br md:from-[#050505]/90 md:via-[#050505]/50 md:to-transparent" />
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0f1014]/90 backdrop-blur-xl flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
        <div className="flex items-center gap-3 mb-8 px-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
             <img src={sabtaLogo} alt="SabTa" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tighter">SAB<span className="text-[#ccff00]">TA</span></span>
        </div>
        <nav className="flex flex-col w-full gap-2">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><HouseIcon weight="fill" className="w-6 h-6" /> Home</button>
          <button onClick={() => navigate('/quizzes')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz</button>
          <button onClick={() => navigate('/leaderboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><TrophyIcon weight="fill" className="w-6 h-6" /> Leaderboard</button>
          {/* 👇 ADDED CLANS BUTTON HERE 👇 */}
          <button onClick={() => navigate('/clans')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <ShieldIcon weight="fill" className="w-6 h-6" /> Clans
          </button>
          <button onClick={() => navigate('/rewards')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><ShoppingBagIcon weight="fill" className="w-6 h-6" /> Rewards Shop</button>
          <button className="flex items-center gap-4 w-full p-3 rounded-xl bg-[#ccff00]/10 text-[#ccff00] font-bold transition"><UserIcon weight="fill" className="w-6 h-6" /> My Profile</button>
        </nav>
        <div className="mt-auto w-full">
          <button onClick={handleLogout} className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition"><SignOutIcon weight="fill" className="w-6 h-6" /> Logout</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative z-10 w-full overflow-x-hidden">
        
        <header className="mb-6 md:mb-10 relative z-10 flex justify-between items-start">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">My Profile</h1>
            <p className="text-gray-400 text-xs md:text-sm">Manage your account settings and view your history.</p>
          </div>
          <button onClick={handleLogout} className="md:hidden bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20"><SignOutIcon weight="bold" className="w-5 h-5" /></button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 relative z-10">
          
          <div className="lg:col-span-4 space-y-6 md:space-y-8">
            {/* Main Profile Card */}
            <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#00f0ff]/10 to-transparent" />

              <input ref={fileInputRef} id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              
              <div className="relative group cursor-pointer" onClick={() => !uploadingAvatar && fileInputRef.current?.click()} title="Click to change profile picture">
                <div className="relative w-36 h-36 md:w-40 md:h-40 flex items-center justify-center">
                  
                  {/* Avatar Image */}
                  <div className="absolute inset-[18%] rounded-full bg-white/10 flex items-center justify-center text-4xl font-bold uppercase overflow-hidden z-10 shadow-inner">
                    {uploadingAvatar ? (
                      <div className="text-xs text-[#ccff00] font-mono animate-pulse">UPLOADING...</div>
                    ) : avatarUrl ? (
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      profile?.display_name?.charAt(0) || 'P'
                    )}
                  </div>

                  {/* Avatar Border Overlay */}
                  {equippedBorder?.cosmetic_items?.preview_url && (
                    <img src={equippedBorder.cosmetic_items.preview_url} alt="Border" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                  )}

                  {/* Camera Hover Overlay */}
                  <div className="hidden md:flex absolute inset-[18%] bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex-col items-center justify-center transition-opacity z-30">
                    <CameraIcon weight="bold" className="w-7 h-7 text-white mb-0.5" />
                    <span className="text-[9px] text-white font-bold uppercase tracking-wider">Change</span>
                  </div>

                  <div className="md:hidden absolute bottom-0 right-0 bg-[#ccff00] text-black p-2.5 rounded-full z-40 shadow-xl border-4 border-[#0f1014]">
                    <CameraIcon weight="bold" className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* 🔧 BADGE LOWERED SLIGHTLY FOR BREATHING ROOM */}
              <div className="relative w-full flex justify-center mt-2 mb-4 z-30">
                {currentBadge && (
                  <img 
                    src={currentBadge.image_url} 
                    alt={currentBadge.name}
                    title={`${currentBadge.name} Tier`}
                    className="w-16 h-16 md:w-20 md:h-20 object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.9)] animate-in zoom-in-50 duration-500"
                  />
                )}
              </div>

              <div className="mt-2 mb-2 relative z-10 w-full flex flex-col items-center">
                {isEditing ? (
                  <div className="w-full max-w-[200px]">
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-black/50 border border-white/20 rounded-xl px-4 py-2 text-center text-lg font-bold focus:outline-none focus:border-[#ccff00] mb-3 text-white" maxLength={20} autoFocus />
                    <div className="flex gap-2 justify-center">
                      <button onClick={handleUpdateName} disabled={saving} className="bg-[#ccff00] text-black px-4 py-2 rounded-lg font-bold hover:bg-white transition flex items-center gap-1"><FloppyDiskIcon weight="bold" /> Save</button>
                      <button onClick={() => setIsEditing(false)} disabled={saving} className="bg-white/10 text-white px-4 py-2 rounded-lg font-bold hover:bg-white/20 transition">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-2 mb-2 flex-wrap">
                      <h2 className="text-2xl font-bold text-white">{profile?.display_name || 'Player'}</h2>
                      <button onClick={() => setIsEditing(true)} className="text-gray-500 hover:text-[#ccff00] transition" title="Edit name">
                        <PencilSimpleIcon weight="bold" className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-[#ccff00] font-mono text-xs bg-[#ccff00]/10 px-3 py-1 rounded-full border border-[#ccff00]/20">{profile?.age_category?.toUpperCase() || 'UNASSIGNED'} TIER</span>
                  </>
                )}
              </div>

              <div className="w-full space-y-3 mt-6 relative z-10">
                <div className="flex justify-between items-center p-3.5 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-gray-400 text-sm font-semibold flex items-center gap-2"><MedalIcon weight="fill" className="text-gray-500 w-5 h-5" /> Total Points</span>
                  <span className="font-bold text-[#ccff00] text-lg flex items-center gap-1.5"><LightningIcon weight="fill"/> {profile?.points || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3.5 bg-black/40 rounded-xl border border-[#ff00a0]/20">
                  <span className="text-gray-400 text-sm font-semibold flex items-center gap-2"><ShoppingBagIcon weight="fill" className="text-[#ff00a0] w-5 h-5" /> Coins Balance</span>
                  <span className="font-bold text-[#ff00a0] text-lg flex items-center gap-1.5"><CoinsIcon weight="fill"/> {profile?.coins || 0}</span>
                </div>
                <div className="flex justify-between items-center p-3.5 bg-black/40 rounded-xl border border-white/5">
                  <span className="text-gray-400 text-sm font-semibold flex items-center gap-2"><CalendarBlankIcon className="text-gray-500 w-5 h-5" /> Joined</span>
                  <span className="font-bold text-sm">{new Date(profile?.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Lifetime Stats */}
            <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#ccff00]/5 rounded-bl-full" />
              <h3 className="text-lg font-bold mb-5 flex items-center gap-2"><StarIcon weight="fill" className="text-[#ccff00]" /> Lifetime Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <GameControllerIcon weight="duotone" className="text-[#00f0ff] w-6 h-6 mb-2" />
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Played</p>
                  <p className="text-xl font-bold">{stats.totalQuizzes}</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <TargetIcon weight="duotone" className="text-[#ccff00] w-6 h-6 mb-2" />
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Accuracy</p>
                  <p className="text-xl font-bold">{stats.accuracy}%</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <TrophyIcon weight="duotone" className="text-[#ff00a0] w-6 h-6 mb-2" />
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Best Score</p>
                  <p className="text-xl font-bold">{stats.bestScore}</p>
                </div>
                <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                  <CoinsIcon weight="fill" className="text-[#ff00a0] w-6 h-6 mb-2" />
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Coins Earned</p>
                  <p className="text-xl font-bold text-[#ff00a0]">{stats.totalCoinsEarned}</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: TABS */}
          <div className="lg:col-span-8">
            <div className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 md:p-8 h-full">
              
              <div className="flex flex-wrap gap-2 mb-6 border-b border-white/10 pb-4">
                <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${activeTab === 'history' ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white'}`}>Quiz History</button>
                <button onClick={() => setActiveTab('inventory')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${activeTab === 'inventory' ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white'}`}>My Inventory</button>
                <button onClick={() => setActiveTab('friends')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${activeTab === 'friends' ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white'}`}>Friends</button>
              </div>

              {activeTab === 'history' && (
                <div className="space-y-3">
                  {history.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-10">No quizzes played yet.</p>
                  ) : (
                    history.map((attempt) => {
                      const totalQ = attempt.correct_answers + attempt.incorrect_answers + attempt.unanswered_questions
                      const acc = totalQ > 0 ? Math.round((attempt.correct_answers / totalQ) * 100) : 0

                      return (
                        <div key={attempt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${acc >= 80 ? 'bg-green-500/10 text-green-400' : acc >= 50 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                              <CheckCircleIcon weight="fill" className="w-6 h-6" />
                            </div>
                            <div>
                              <p className="font-bold text-white text-base">Quiz Completed</p>
                              <p className="text-xs text-gray-500 font-mono mt-0.5">{new Date(attempt.created_at).toLocaleDateString()} • {acc}% Accuracy</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <div className="bg-[#ccff00]/10 px-3 py-1.5 rounded-lg text-center"><p className="text-[9px] text-gray-400 uppercase font-bold">Points</p><p className="font-bold text-[#ccff00] text-sm">+{attempt.score}</p></div>
                            <div className="bg-[#ff00a0]/10 px-3 py-1.5 rounded-lg text-center"><p className="text-[9px] text-gray-400 uppercase font-bold">Coins</p><p className="font-bold text-[#ff00a0] text-sm">+{attempt.correct_answers * 150}</p></div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {activeTab === 'inventory' && (
                <div className="space-y-8">
                  {inventory.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingBagIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 font-bold mb-1">Your inventory is empty</p>
                      <p className="text-gray-500 text-sm mb-6">Buy items from the Rewards Shop to customize your profile.</p>
                      <button onClick={() => navigate('/rewards')} className="bg-[#ccff00] text-black px-6 py-2 rounded-xl font-bold hover:bg-white transition">Visit Shop</button>
                    </div>
                  ) : (
                    Object.entries(categorizedInventory).map(([type, items]) => (
                      <div key={type} className="mb-6">
                        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">
                          {categoryLabels[type] || type}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(items as any[]).map((invItem) => (
                            <div key={invItem.id} className={`flex items-center justify-between p-4 bg-black/40 border rounded-2xl transition ${invItem.is_equipped ? 'border-[#ccff00]/50 shadow-[0_0_15px_rgba(204,255,0,0.1)]' : 'border-white/5'}`}>
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                                  {invItem.cosmetic_items?.preview_url ? (
                                    <img src={invItem.cosmetic_items.preview_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <StarIcon className="w-full h-full p-3 text-gray-500" />
                                  )}
                                </div>
                                <div>
                                  <p className="font-bold text-white text-sm">{invItem.cosmetic_items?.name}</p>
                                  <p className="text-[10px] uppercase font-bold text-gray-500">{invItem.cosmetic_items?.cosmetic_type}</p>
                                </div>
                              </div>
                              
                              {invItem.is_equipped ? (
                                <button 
                                  onClick={() => handleEquip(invItem.cosmetic_item_id)}
                                  disabled={equipping}
                                  className="text-xs font-bold text-[#ccff00] hover:text-[#b3e600] flex items-center gap-1 bg-[#ccff00]/10 hover:bg-[#ccff00]/20 px-3 py-1.5 rounded-lg border border-[#ccff00]/20 transition disabled:opacity-50"
                                  title="Click to Unequip"
                                >
                                  <CheckIcon weight="bold" /> Equipped
                                </button>
                              ) : (
                                <button 
                                  onClick={() => handleEquip(invItem.cosmetic_item_id)}
                                  disabled={equipping}
                                  className="text-xs font-bold text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition disabled:opacity-50"
                                >
                                  Equip
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'friends' && (
                <div>
                  <div className="flex gap-2 mb-6">
                    <button 
                      onClick={() => setFriendTab('followers')} 
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${friendTab === 'followers' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                      Followers ({followers.length})
                    </button>
                                      <button 
                      onClick={() => setFriendTab('following')} 
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${friendTab === 'following' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                    >
                      Following ({following.length})
                    </button>
                  </div>
                                    <div className="space-y-3">
                    {(friendTab === 'followers' ? followers : following).length === 0 ? (
                      <div className="text-center py-10">
                        <UsersIcon weight="duotone" className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-400 text-sm font-bold">
                          {friendTab === 'followers' ? "You don't have any new followers." : "You aren't following anyone yet."}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          {friendTab === 'followers' ? "When someone follows you, they will appear here." : "Find players on the Leaderboard and add them."}
                        </p>
                      </div>
                    ) : (
                      (friendTab === 'followers' ? followers : following).map((connection) => {
                        const player = connection.profiles
                        if (!player) return null
                        
                        const friendBadge = getPlayerBadge(player.points || 0, allBadges)
                        
                        // 🔧 Extract the equipped avatar border for this specific friend
                        const friendEquippedBorder = player.user_inventory?.find(
                          (inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'avatar_border'
                        )

                        return (
                          <div 
                            key={player.id} 
                            onClick={() => navigate(`/player/${player.id}`)}
                            className="flex items-center justify-between p-3 sm:p-4 bg-black/40 border border-white/5 rounded-2xl hover:border-[#ccff00]/50 transition cursor-pointer group"
                          >
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                              
                              {/* 🔧 Avatar Container to support Borders */}
                              <div className="relative w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center shrink-0">
                                
                                {/* Inner Avatar Image */}
                                <div className="absolute inset-[15%] rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-sm font-bold uppercase z-10">
                                  {player.avatar_url ? (
                                    <img src={player.avatar_url} className="w-full h-full object-cover" />
                                  ) : (
                                    player.display_name?.charAt(0) || 'P'
                                  )}
                                </div>

                                {/* Avatar Border Overlay */}
                                {friendEquippedBorder?.cosmetic_items?.preview_url && (
                                  <img 
                                    src={friendEquippedBorder.cosmetic_items.preview_url} 
                                    alt="Border" 
                                    className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" 
                                  />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-bold text-white text-sm sm:text-base group-hover:text-[#ccff00] transition truncate">{player.display_name}</p>
                                  {friendBadge && (
                                    <img src={friendBadge.image_url} alt={friendBadge.name} title={friendBadge.name} className="w-5 h-5 object-contain" />
                                  )}
                                </div>
                                <p className="text-[10px] text-gray-500 uppercase font-bold flex items-center gap-1">
                                  <LightningIcon weight="fill" className="text-[#ccff00]" /> {player.points} PTS
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {friendTab === 'followers' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleFollowBack(player.id, player)
                                  }}
                                  disabled={followBackLoading === player.id}
                                  className="text-[10px] sm:text-xs font-bold bg-[#ccff00] text-black px-3 py-1.5 rounded-lg hover:bg-white transition flex items-center gap-1 disabled:opacity-50"
                                >
                                  <UserPlusIcon weight="bold" className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">
                                    {followBackLoading === player.id ? '...' : 'Follow Back'}
                                  </span>
                                  <span className="sm:hidden">Back</span>
                                </button>
                              )}
                              
                              {friendTab === 'following' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleUnfollow(player.id)
                                  }}
                                  disabled={unfollowLoading === player.id}
                                  className="text-[10px] sm:text-xs font-bold bg-white/10 text-white hover:bg-red-500/20 hover:text-red-400 px-3 py-1.5 rounded-lg transition flex items-center gap-1 disabled:opacity-50"
                                >
                                  <UserMinusIcon weight="bold" className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">
                                    {unfollowLoading === player.id ? '...' : 'Unfollow'}
                                  </span>
                                  <span className="sm:hidden">Unfollow</span>
                                </button>
                              )}

                              <CaretRightIcon className="w-5 h-5 text-gray-500 group-hover:text-white transition" />
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* MOBILE NAVIGATION */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1 text-gray-400"><HouseIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Home</span></button>
        <button onClick={() => navigate('/quizzes')} className="flex flex-col items-center gap-1 text-gray-400"><GameControllerIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Play</span></button>
        <button onClick={() => navigate('/leaderboard')} className="flex flex-col items-center gap-1 text-gray-400"><TrophyIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Ranks</span></button>
        {/* 👇 ADDED CLANS BUTTON TO MOBILE BOTTOM NAV 👇 */}
        <button onClick={() => navigate('/clans')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <ShieldIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Clans</span>
        </button>
        <button onClick={() => navigate('/rewards')} className="flex flex-col items-center gap-1 text-gray-400"><ShoppingBagIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Shop</span></button>
        <button className="flex flex-col items-center gap-1 text-[#ccff00]"><UserIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Profile</span></button>
      </nav>
    </div>
  )
}