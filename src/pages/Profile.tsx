// src/pages/Profile.tsx
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  UserIcon, SignOutIcon, HouseIcon, GameControllerIcon, TrophyIcon, ShoppingBagIcon,
  LightningIcon, CheckCircleIcon, PencilSimpleIcon, FloppyDiskIcon, 
  CalendarBlankIcon, TargetIcon, CoinsIcon, MedalIcon, StarIcon, CheckIcon, XIcon,
  CameraIcon
} from '@phosphor-icons/react'
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
  
  // Edit State
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')

  // Data State
  const [history, setHistory] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'history' | 'inventory'>('inventory')
  
  // Play Menu State
  const [showPlayMenu, setShowPlayMenu] = useState(false)
  const [availableQuizzes, setAvailableQuizzes] = useState<any[]>([])
  const [loadingQuizzes, setLoadingQuizzes] = useState(false)

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
        const avgAccuracy = totalQuizzes > 0 ? attempts.reduce((acc, curr) => acc + (curr.accuracy || 0), 0) / totalQuizzes : 0
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

      setLoading(false)
    }

    fetchProfileData()
  }, [navigate])

  const openPlayMenu = async () => {
    setShowPlayMenu(true)
    setLoadingQuizzes(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !profile?.age_category) return

      const { data: completed } = await supabase
        .from('quiz_attempts')
        .select('quiz_id')
        .eq('user_id', user.id)
        .eq('status', 'completed') 
        
      const completedIds = completed?.map(c => c.quiz_id) || []

      let query = supabase
        .from('quizzes')
        .select('id, title, category, difficulty, questions(count)')
        .eq('age_category', profile.age_category)
        .eq('status', 'published')

      if (completedIds.length > 0) {
        query = query.not('id', 'in', `(${completedIds.join(',')})`)
      }

      const { data: quizzes } = await query
      setAvailableQuizzes((quizzes || []).filter(q => (q.questions as any)?.[0]?.count > 0))
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingQuizzes(false)
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
      // ✅ FIX: Compress the image before uploading
      const compressedFile = await new Promise<File>((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 500; // Max width/height in pixels (good for avatars)
          let width = img.width;
          let height = img.height;

          // Resize calculation
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
          
          // Convert to JPEG with 0.8 (80%) quality
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

      // 1. Delete the old avatar from storage if it exists
      if (avatarUrl && avatarUrl.includes('/storage/v1/object/public/avatars/')) {
        const oldFilePath = avatarUrl.split('/avatars/')[1]
        if (oldFilePath) {
          await supabase.storage.from('avatars').remove([oldFilePath])
        }
      }

      // 2. Upload the compressed avatar
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

      // Update local state instantly with strict targeting
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

  if (loading) {
    return <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">LOADING PROFILE...</div>
  }

  const equippedBorder = inventory.find(i => i.is_equipped && i.cosmetic_items?.cosmetic_type === 'avatar_border')
  const equippedBackground = inventory.find(i => i.is_equipped && i.cosmetic_items?.cosmetic_type === 'background')

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      
      {/* SIDEBAR */}
      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0f1014] flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
        <div className="flex items-center gap-3 mb-8 px-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
             <img src={sabtaLogo} alt="SabTa" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tighter">SAB<span className="text-[#ccff00]">TA</span></span>
        </div>
        <nav className="flex flex-col w-full gap-2">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><HouseIcon weight="fill" className="w-6 h-6" /> Home</button>
          <button onClick={openPlayMenu} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz</button>
          <button onClick={() => navigate('/leaderboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><TrophyIcon weight="fill" className="w-6 h-6" /> Leaderboard</button>
          <button onClick={() => navigate('/rewards')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition"><ShoppingBagIcon weight="fill" className="w-6 h-6" /> Rewards Shop</button>
          <button className="flex items-center gap-4 w-full p-3 rounded-xl bg-[#ccff00]/10 text-[#ccff00] font-bold transition"><UserIcon weight="fill" className="w-6 h-6" /> My Profile</button>
        </nav>
        <div className="mt-auto w-full">
          <button onClick={handleLogout} className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition"><SignOutIcon weight="fill" className="w-6 h-6" /> Logout</button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative overflow-hidden">
        
        {equippedBackground?.cosmetic_items?.preview_url && (
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img src={equippedBackground.cosmetic_items.preview_url} alt="bg" className="w-full h-full object-cover opacity-20" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/80 via-[#050505]/60 to-[#050505]" />
          </div>
        )}

        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#00f0ff]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#ff00a0]/5 rounded-full blur-[100px] pointer-events-none" />

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
            <div className="bg-[#0f1014]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#00f0ff]/10 to-transparent" />

              <input
                ref={fileInputRef}
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              
              <div
                className="relative group cursor-pointer"
                onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
                title="Click to change profile picture"
              >
                
                <div className="relative w-32 h-32 md:w-36 md:h-36 flex items-center justify-center">
                  
                  <div className="absolute inset-[15%] rounded-full bg-white/10 flex items-center justify-center text-4xl font-bold uppercase overflow-hidden z-10 shadow-inner">
                    {uploadingAvatar ? (
                      <div className="text-xs text-[#ccff00] font-mono animate-pulse">UPLOADING...</div>
                    ) : avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt="Avatar" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      profile?.display_name?.charAt(0) || 'P'
                    )}
                  </div>

                  {equippedBorder?.cosmetic_items?.preview_url && (
                    <img 
                      src={equippedBorder.cosmetic_items.preview_url} 
                      alt="Border" 
                      className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" 
                    />
                  )}

                  <div className="hidden md:flex absolute inset-[15%] bg-black/60 rounded-full opacity-0 group-hover:opacity-100 flex-col items-center justify-center transition-opacity z-30">
                    <CameraIcon weight="bold" className="w-7 h-7 text-white mb-0.5" />
                    <span className="text-[9px] text-white font-bold uppercase tracking-wider">Change</span>
                  </div>

                  <div className="md:hidden absolute bottom-0 right-0 bg-[#ccff00] text-black p-2.5 rounded-full z-40 shadow-xl border-4 border-[#0f1014]">
                    <CameraIcon weight="bold" className="w-5 h-5" />
                  </div>

                </div>

              </div>

              <div className="mt-5 mb-2 relative z-10 w-full flex flex-col items-center">
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
                    <div className="flex items-center gap-2 mb-2">
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
            <div className="bg-[#0f1014]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-6 relative overflow-hidden">
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
            <div className="bg-[#0f1014]/80 backdrop-blur-xl border border-white/10 rounded-[2rem] p-5 md:p-8 h-full">
              
              <div className="flex gap-2 mb-6 border-b border-white/10 pb-4">
                <button onClick={() => setActiveTab('history')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${activeTab === 'history' ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white'}`}>Quiz History</button>
                <button onClick={() => setActiveTab('inventory')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${activeTab === 'inventory' ? 'bg-[#ccff00] text-black' : 'text-gray-400 hover:text-white'}`}>My Inventory</button>
              </div>

              {activeTab === 'history' ? (
                <div className="space-y-3">
                  {history.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-10">No quizzes played yet.</p>
                  ) : (
                    history.map((attempt) => (
                      <div key={attempt.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-black/40 border border-white/5 rounded-2xl gap-4">
                        <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${attempt.accuracy >= 80 ? 'bg-green-500/10 text-green-400' : attempt.accuracy >= 50 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'}`}>
                            <CheckCircleIcon weight="fill" className="w-6 h-6" />
                          </div>
                          <div>
                            <p className="font-bold text-white text-base">Quiz Completed</p>
                            <p className="text-xs text-gray-500 font-mono mt-0.5">{new Date(attempt.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <div className="bg-[#ccff00]/10 px-3 py-1.5 rounded-lg text-center"><p className="text-[9px] text-gray-400 uppercase font-bold">Points</p><p className="font-bold text-[#ccff00] text-sm">+{attempt.score}</p></div>
                          <div className="bg-[#ff00a0]/10 px-3 py-1.5 rounded-lg text-center"><p className="text-[9px] text-gray-400 uppercase font-bold">Coins</p><p className="font-bold text-[#ff00a0] text-sm">+{attempt.correct_answers * 150}</p></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-6">
                  {inventory.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingBagIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400 font-bold mb-1">Your inventory is empty</p>
                      <p className="text-gray-500 text-sm mb-6">Buy items from the Rewards Shop to customize your profile.</p>
                      <button onClick={() => navigate('/rewards')} className="bg-[#ccff00] text-black px-6 py-2 rounded-xl font-bold hover:bg-white transition">Visit Shop</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {inventory.map((invItem) => (
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
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* MOBILE NAVIGATION */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1 text-gray-400"><HouseIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Home</span></button>
        <button onClick={openPlayMenu} className="flex flex-col items-center gap-1 text-gray-400"><GameControllerIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Play</span></button>
        <button onClick={() => navigate('/leaderboard')} className="flex flex-col items-center gap-1 text-gray-400"><TrophyIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Ranks</span></button>
        <button onClick={() => navigate('/rewards')} className="flex flex-col items-center gap-1 text-gray-400"><ShoppingBagIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Shop</span></button>
        <button className="flex flex-col items-center gap-1 text-[#ccff00]"><UserIcon weight="fill" className="w-5 h-5" /><span className="text-[9px] font-bold">Profile</span></button>
      </nav>

      {/* CHOOSE A CHALLENGE MODAL (Responsive) */}
      {showPlayMenu && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl sm:rounded-[2rem] p-5 sm:p-6 md:p-8 max-w-md w-full shadow-2xl relative max-h-[90vh] flex flex-col">
            <button onClick={() => setShowPlayMenu(false)} className="absolute top-4 right-4 sm:top-6 sm:right-6 text-gray-400 hover:text-white transition bg-white/5 p-1.5 rounded-lg"><XIcon weight="bold" size={20} /></button>
            
            <h2 className="text-xl sm:text-2xl font-bold mb-1">Choose a Challenge</h2>
            <p className="text-gray-400 text-xs sm:text-sm mb-4 sm:mb-6">Select a quiz to play & earn coins.</p>
            
            <div className="flex items-center justify-between mb-4 bg-[#ff00a0]/5 border border-[#ff00a0]/20 rounded-xl px-3 sm:px-4 py-2">
              <span className="text-[10px] sm:text-xs text-gray-400 font-semibold">Your Balance</span>
              <div className="flex items-center gap-1.5">
                <CoinsIcon weight="fill" className="text-[#ff00a0] w-4 h-4" />
                <span className="font-bold text-[#ff00a0] text-xs sm:text-sm">{profile?.coins || 0}</span>
              </div>
            </div>
            
            <div className="space-y-2 sm:space-y-3 overflow-y-auto pr-1 flex-1">
              {loadingQuizzes ? (
                <p className="text-center text-[#ccff00] font-mono text-xs sm:text-sm py-4 animate-pulse">LOADING...</p>
              ) : availableQuizzes.length === 0 ? (
                <div className="text-center py-6 sm:py-8 bg-black/20 rounded-2xl border border-white/5">
                  <TrophyIcon weight="duotone" className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600 mx-auto mb-2 sm:mb-3" />
                  <p className="text-gray-400 text-xs sm:text-sm font-bold">All caught up!</p>
                  <p className="text-gray-500 text-[10px] sm:text-xs mt-1">You've completed all available quizzes for your tier.</p>
                </div>
              ) : (
                availableQuizzes.map((q) => (
                  <button key={q.id} onClick={() => { setShowPlayMenu(false); navigate(`/play/${q.id}`) }} className="w-full text-left bg-black/40 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 hover:border-[#ccff00]/50 hover:bg-[#ccff00]/5 transition group flex justify-between items-center">
                    <div className="pr-2">
                      <p className="font-bold text-xs sm:text-sm text-white group-hover:text-[#ccff00] transition line-clamp-1">{q.title}</p>
                      <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">{q.category}</p>
                    </div>
                    <span className={`text-[9px] sm:text-[10px] font-bold uppercase px-2 sm:px-2.5 py-1 rounded-lg border shrink-0 ${q.difficulty === 'hard' ? 'bg-red-500/10 text-red-400 border-red-500/20' : q.difficulty === 'intermediate' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-green-500/10 text-green-400 border-green-500/20'}`}>{q.difficulty}</span>
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