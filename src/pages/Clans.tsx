import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  ShieldIcon, UsersIcon, TrophyIcon, PlusIcon, XIcon, 
  CameraIcon, PencilIcon, TrashIcon, CaretLeftIcon, 
  ChatCircleDotsIcon, PaperPlaneRightIcon, CaretRightIcon,
  CheckCircleIcon, WarningCircleIcon
} from '@phosphor-icons/react'
import { useNotifications } from './notifications/NotificationsProvider'

export default function Clans() {
  const navigate = useNavigate()
  const { profile, setProfile } = useNotifications()
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // State for the player's equipped background
  const [equippedBackground, setEquippedBackground] = useState<string | null>(null)

  // Custom Popup State
  const [notification, setNotification] = useState<{ type: 'success' | 'error', msg: string } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, type: 'delete' | 'leave' | null }>({ isOpen: false, type: null })

  // Create Clan form state
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [clanAvatar, setClanAvatar] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Edit Clan State
  const [myClan, setMyClan] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editTag, setEditTag] = useState('')
  const [editAvatar, setEditAvatar] = useState<File | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // Clan Details Modal State
  const [viewingClan, setViewingClan] = useState<any | null>(null)
  const [clanMembers, setClanMembers] = useState<any[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Clan Chat State
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Auto-dismiss toast
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const fetchClans = async () => {
    const { data } = await supabase.from('clan_leaderboard').select('*').limit(50)
    if (data) {
      setLeaderboard(data)
      if (profile?.clan_id) {
        const found = data.find(c => c.clan_id === profile.clan_id)
        if (found) setMyClan(found)
      }
    }
    setLoading(false)
  }

  // Fetch the player's equipped background on load
  useEffect(() => {
    if (!profile?.id) return
    const fetchBackground = async () => {
      const { data } = await supabase
        .from('user_inventory')
        .select('*, cosmetic_items(*)')
        .eq('user_id', profile.id)
        .eq('is_equipped', true)

      if (data) {
        const bg = data.find((i) => i.cosmetic_items?.cosmetic_type === 'background')
        if (bg?.cosmetic_items?.preview_url) setEquippedBackground(bg.cosmetic_items.preview_url)
      }
    }
    fetchBackground()
  }, [profile?.id])

  useEffect(() => { if (profile) fetchClans() }, [profile])

  const getEquippedBorder = (userData: any) => {
    if (!userData?.user_inventory) return null;
    const equipped = userData.user_inventory.find((ui: any) => ui.is_equipped && ui.cosmetic_items?.cosmetic_type === 'avatar_border');
    return equipped?.cosmetic_items?.preview_url || null;
  }

  useEffect(() => {
    if (!isChatOpen || !profile?.clan_id) return

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('clan_messages')
        .select(`
          *, 
          profiles (
            display_name, 
            avatar_url,
            user_inventory (
              is_equipped,
              cosmetic_items (cosmetic_type, preview_url)
            )
          )
        `)
        .eq('clan_id', profile.clan_id)
        .order('created_at', { ascending: true })
        .limit(100)
      
      if (data) setMessages(data)
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    fetchMessages()

    const channel = supabase
      .channel('clan-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'clan_messages', filter: `clan_id=eq.${profile.clan_id}` },
        async (payload) => {
          const { data: userProfile } = await supabase
            .from('profiles')
            .select(`
              display_name, 
              avatar_url,
              user_inventory (
                is_equipped,
                cosmetic_items (cosmetic_type, preview_url)
              )
            `)
            .eq('id', payload.new.user_id)
            .single()
          
          const newMsg = { ...payload.new, profiles: userProfile }
          setMessages((prev) => [...prev, newMsg])
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isChatOpen, profile?.clan_id])

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !profile?.clan_id) return
    
    const msgText = newMessage.trim()
    setNewMessage('')

    await supabase.from('clan_messages').insert({
      clan_id: profile.clan_id,
      user_id: profile.id,
      message: msgText
    })
  }

  // 🔧 FIXED: Fetch user_inventory to show the border for members
  const handleViewClan = async (clan: any) => {
    setViewingClan(clan)
    setLoadingMembers(true)
    const { data } = await supabase
      .from('profiles')
      .select(`
        id, display_name, avatar_url, points,
        user_inventory ( is_equipped, cosmetic_items ( cosmetic_type, preview_url ) )
      `)
      .eq('clan_id', clan.clan_id)
      .order('points', { ascending: false })
    if (data) setClanMembers(data)
    setLoadingMembers(false)
  }

  const getFilePathFromUrl = (url: string) => {
    if (!url) return null;
    const parts = url.split('/clan-avatars/');
    return parts.length > 1 ? parts[1] : null;
  }

  const handleCreateClan = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)
    
    try {
      let avatarUrl = null

      if (clanAvatar) {
        const fileExt = clanAvatar.name.split('.').pop()
        const fileName = `${Math.random()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('clan-avatars')
          .upload(fileName, clanAvatar)

        if (uploadError) throw uploadError

        const { data: publicUrlData } = supabase.storage
          .from('clan-avatars')
          .getPublicUrl(fileName)
          
        avatarUrl = publicUrlData.publicUrl
      }

      const { data: newClan, error } = await supabase.from('clans').insert({
        name, 
        tag: tag.toUpperCase(), 
        leader_id: profile.id,
        avatar_url: avatarUrl
      }).select().single()

      if (error) throw error

      await supabase.from('profiles').update({ clan_id: newClan.id }).eq('id', profile.id)
      setProfile({ ...profile, clan_id: newClan.id })
      
      setNotification({ type: 'success', msg: "Clan created successfully!" })
      fetchClans()
    } catch (err: any) {
      setNotification({ type: 'error', msg: err.message })
    } finally {
      setUploading(false)
    }
  }

  const handleUpdateClan = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploading(true)
    try {
      let newAvatarUrl = null

      if (editAvatar) {
        const fileExt = editAvatar.name.split('.').pop()
        const fileName = `edit_${Math.random()}.${fileExt}`
        
        const { error: uploadError } = await supabase.storage
          .from('clan-avatars')
          .upload(fileName, editAvatar)
          
        if (uploadError) throw uploadError

        const { data } = supabase.storage
          .from('clan-avatars')
          .getPublicUrl(fileName)
          
        newAvatarUrl = data.publicUrl

        const oldFilePath = getFilePathFromUrl(myClan.clan_avatar)
        if (oldFilePath) {
          await supabase.storage.from('clan-avatars').remove([oldFilePath])
        }
      }

      const { error } = await supabase.rpc('update_clan', {
        p_clan_id: myClan.clan_id,
        p_name: editName,
        p_tag: editTag.toUpperCase(),
        p_avatar_url: newAvatarUrl
      })

      if (error) throw error
      
      setNotification({ type: 'success', msg: "Clan updated successfully!" })
      setIsEditing(false)
      setEditAvatar(null)
      fetchClans()
    } catch (err: any) {
      setNotification({ type: 'error', msg: err.message })
    } finally {
      setUploading(false)
    }
  }

  const handleJoinClan = async (clanId: string) => {
    const { error } = await supabase.rpc('join_clan', { p_clan_id: clanId })
    if (!error) {
      setProfile({ ...profile, clan_id: clanId })
      setNotification({ type: 'success', msg: "Joined clan!" })
      fetchClans()
    }
  }

  const handleLeaveClan = () => {
    if (myClan?.leader_id === profile.id) {
      setConfirmModal({ isOpen: true, type: 'delete' })
    } else {
      setConfirmModal({ isOpen: true, type: 'leave' })
    }
  }

  const executeLeaveClan = async () => {
    setConfirmModal({ isOpen: false, type: null })
    
    if (myClan?.leader_id === profile.id) {
      const oldFilePath = getFilePathFromUrl(myClan.clan_avatar)
      if (oldFilePath) {
        await supabase.storage.from('clan-avatars').remove([oldFilePath])
      }

      const { error } = await supabase.rpc('delete_clan', { p_clan_id: myClan.clan_id })
      if (!error) {
        setProfile({ ...profile, clan_id: null })
        fetchClans()
        setNotification({ type: 'success', msg: "Clan deleted." })
      } else {
        setNotification({ type: 'error', msg: error.message })
      }
    } else {
      const { error } = await supabase.rpc('leave_clan')
      if (!error) {
        setProfile({ ...profile, clan_id: null })
        fetchClans()
        setNotification({ type: 'success', msg: "Left clan." })
      } else {
        setNotification({ type: 'error', msg: error.message })
      }
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditAvatar(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">
        LOADING CLANS...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white relative">
      
      {/* TOAST NOTIFICATION */}
      {notification && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl font-bold text-sm shadow-2xl border flex items-center gap-2 animate-in slide-in-from-top-4 ${
          notification.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {notification.type === 'success' ? <CheckCircleIcon weight="fill" /> : <WarningCircleIcon weight="fill" />}
          {notification.msg}
        </div>
      )}

      {/* BACKGROUND */}
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

      <div className="max-w-5xl mx-auto p-4 py-10 relative z-10">
        
        <div className="flex items-center gap-3 mb-8">
          <button 
            onClick={() => navigate('/dashboard')}
            className="p-2 bg-[#0f1014]/90 backdrop-blur-md border border-white/10 hover:bg-white/10 rounded-xl transition text-gray-400 hover:text-white"
          >
            <CaretLeftIcon weight="bold" size={20} />
          </button>
          <h1 className="text-3xl font-black flex items-center gap-3 drop-shadow-md">
            <ShieldIcon weight="fill" className="text-[#ccff00]" /> Clan Hub
          </h1>
        </div>

        {profile?.clan_id ? (
          <div className="bg-[#0f1014]/90 backdrop-blur-md border border-[#ccff00]/30 p-6 rounded-3xl mb-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-black/50 border border-white/10 rounded-2xl flex items-center justify-center font-bold text-xl text-[#ccff00] overflow-hidden shrink-0">
                  {myClan?.clan_avatar ? (
                    <img src={myClan.clan_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    myClan?.clan_tag
                  )}
                </div>
              <div>
                <h2 className="text-xl font-bold text-[#ccff00]">{myClan?.clan_name || 'Your Clan'}</h2>
                <p className="text-gray-400 text-sm">Play quizzes to increase your clan's total points.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              
              <button 
                onClick={() => setIsChatOpen(true)} 
                className="bg-[#00f0ff] text-black px-4 py-2 rounded-xl text-sm font-bold hover:bg-white transition flex items-center gap-2"
              >
                <ChatCircleDotsIcon weight="bold" /> Chat
              </button>

              {myClan?.leader_id === profile.id && (
                <button 
                  onClick={() => { 
                    setIsEditing(true); 
                    setEditName(myClan.clan_name); 
                    setEditTag(myClan.clan_tag); 
                  }} 
                  className="bg-[#ccff00] text-black px-4 py-2 rounded-xl text-sm font-bold hover:bg-white transition flex items-center gap-2"
                >
                  <PencilIcon weight="bold" /> Edit
                </button>
              )}
              <button onClick={handleLeaveClan} className="bg-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-500/30 transition flex items-center gap-2">
                <TrashIcon weight="bold" /> {myClan?.leader_id === profile.id ? 'Delete' : 'Leave'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-[#0f1014]/90 backdrop-blur-md border border-white/10 p-6 rounded-3xl">
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><PlusIcon /> Create a Clan</h2>
              <form onSubmit={handleCreateClan} className="space-y-4">
                
                <div className="flex justify-center mb-4">
                  <div onClick={() => fileInputRef.current?.click()} className="w-24 h-24 rounded-2xl bg-black/50 border-2 border-dashed border-white/20 hover:border-[#ccff00] flex flex-col items-center justify-center cursor-pointer overflow-hidden transition relative group">
                    {clanAvatar ? (
                      <img src={URL.createObjectURL(clanAvatar)} alt="Clan" className="w-full h-full object-cover" />
                    ) : (
                      <>
                        <CameraIcon size={24} className="text-gray-400 group-hover:text-[#ccff00] mb-1" />
                        <span className="text-[10px] text-gray-500 font-bold">Add Photo</span>
                      </>
                    )}
                  </div>
                  <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => setClanAvatar(e.target.files?.[0] || null)} className="hidden" />
                </div>

                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1">Clan Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} maxLength={20} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl" placeholder="e.g. Trivia Masters" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1">Clan Tag (Max 4 chars)</label>
                  <input required value={tag} onChange={e => setTag(e.target.value)} maxLength={4} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl uppercase" placeholder="e.g. TRIV" />
                </div>
                <button disabled={uploading} className="w-full bg-[#ccff00] text-black font-bold py-3 rounded-xl hover:bg-white transition disabled:opacity-50">
                  {uploading ? 'Creating...' : 'Create & Join'}
                </button>
              </form>
            </div>
            
            <div className="bg-[#0f1014]/90 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex flex-col justify-center items-center text-center">
              <TrophyIcon weight="fill" className="w-16 h-16 text-gray-500 mb-4" />
              <h3 className="font-bold text-white mb-1">Join an Existing Clan</h3>
              <p className="text-xs text-gray-400">Scroll down to see the top Clans and click "Join" to join their ranks!</p>
            </div>
          </div>
        )}

        {/* CLAN LEADERBOARD */}
        <div className="bg-[#0f1014]/90 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden">
          <div className="p-5 border-b border-white/10 bg-black/40">
            <h2 className="font-bold flex items-center gap-2"><TrophyIcon className="text-[#ffd700]" /> Top Clans</h2>
          </div>
          <div className="divide-y divide-white/5">
            {leaderboard.map((clan, idx) => (
              <div key={clan.clan_id} className="flex items-center justify-between p-4 hover:bg-white/5 transition">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => handleViewClan(clan)}>
                  <span className={`text-lg font-black w-6 text-center ${idx === 0 ? 'text-[#ffd700]' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-[#cd7f32]' : 'text-gray-600'}`}>
                    #{idx + 1}
                  </span>
                  <div className="w-12 h-12 bg-black/50 border border-white/10 rounded-xl flex items-center justify-center font-bold text-sm text-[#ccff00] overflow-hidden shrink-0">
                    {clan.clan_avatar ? <img src={clan.clan_avatar} alt="" className="w-full h-full object-cover" /> : clan.clan_tag}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm hover:text-[#ccff00] transition">{clan.clan_name}</p>
                    <p className="text-[10px] text-gray-400 flex items-center gap-1"><UsersIcon size={12} /> {clan.member_count} members</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-bold text-[#ccff00]">{clan.total_points.toLocaleString()} pts</p>
                    <p className="text-[10px] text-gray-500">Clan Total</p>
                  </div>
                  {!profile?.clan_id && (
                    <button onClick={() => handleJoinClan(clan.clan_id)} className="bg-white/10 hover:bg-[#ccff00] hover:text-black px-4 py-2 rounded-lg text-xs font-bold transition">
                      Join
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CLAN CHAT MODAL */}
        {isChatOpen && myClan && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f1014] border border-white/10 rounded-3xl w-full max-w-lg h-[80vh] flex flex-col shadow-2xl relative animate-in zoom-in-95">
              
              <div className="p-4 border-b border-white/10 bg-black/40 flex justify-between items-center shrink-0 rounded-t-3xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black/50 border border-white/10 rounded-lg flex items-center justify-center font-bold text-sm text-[#ccff00] overflow-hidden">
                    {myClan.clan_avatar ? <img src={myClan.clan_avatar} alt="" className="w-full h-full object-cover" /> : myClan.clan_tag}
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">{myClan.clan_name}</h2>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Clan Chat</p>
                  </div>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-gray-400 hover:text-white">
                  <XIcon weight="bold" size={20} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 admin-custom-scrollbar bg-[#050505]/50">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 text-sm mt-10">No messages yet. Say hello to your clan!</div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.user_id === profile.id
                    const borderUrl = getEquippedBorder(msg.profiles)
                    
                    return (
                      <div key={msg.id} className={`flex gap-2 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                        
                        <div 
                          onClick={() => {
                            if (!isMe) {
                              setIsChatOpen(false);
                              navigate('/player/' + msg.user_id);
                            }
                          }}
                          className={`relative w-8 h-8 shrink-0 flex items-center justify-center ${!isMe ? 'cursor-pointer hover:opacity-80 transition' : ''}`}
                        >
                          <div className="absolute inset-[15%] rounded-full bg-white/10 overflow-hidden z-10">
                            {msg.profiles?.avatar_url ? (
                              <img src={msg.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs font-bold text-gray-400">{msg.profiles?.display_name?.charAt(0) || '?'}</div>
                            )}
                          </div>
                          {borderUrl && (
                            <img src={borderUrl} alt="border" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                          )}
                        </div>

                        <div>
                          {!isMe && (
                            <p 
                              onClick={() => {
                                setIsChatOpen(false);
                                navigate('/player/' + msg.user_id);
                              }}
                              className="text-[10px] text-gray-400 font-bold mb-0.5 ml-1 cursor-pointer hover:text-[#ccff00] transition"
                            >
                              {msg.profiles?.display_name}
                            </p>
                          )}
                          
                          <div className={`p-3 rounded-2xl text-sm ${isMe ? 'bg-[#ccff00] text-black rounded-tr-sm' : 'bg-[#1a1c23] border border-white/5 text-white rounded-tl-sm'}`}>
                            {msg.message}
                          </div>

                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              <form onSubmit={sendMessage} className="p-3 border-t border-white/10 bg-[#0f1014] shrink-0 rounded-b-3xl">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full bg-black/50 border border-white/10 py-3 pl-4 pr-12 rounded-xl text-white outline-none focus:border-[#ccff00] transition text-sm"
                  />
                  <button 
                    type="submit" 
                    disabled={!newMessage.trim()}
                    className="absolute right-2 p-2 bg-[#ccff00] text-black rounded-lg hover:bg-white transition disabled:opacity-50 disabled:hover:bg-[#ccff00]"
                  >
                    <PaperPlaneRightIcon weight="fill" size={16} />
                  </button>
                </div>
              </form>
              
            </div>
          </div>
        )}

        {/* EDIT CLAN MODAL */}
        {isEditing && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f1014] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in-95">
              <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
                <h2 className="text-xl font-black text-white">Edit Clan</h2>
                <button onClick={handleCancelEdit} className="text-gray-400 hover:text-white"><XIcon weight="bold" size={20}/></button>
              </div>
              <form onSubmit={handleUpdateClan} className="p-5 space-y-4">
                <div className="flex justify-center mb-4">
                  <div onClick={() => editFileInputRef.current?.click()} className="w-24 h-24 rounded-2xl bg-black/50 border-2 border-dashed border-white/20 hover:border-[#ccff00] flex flex-col items-center justify-center cursor-pointer overflow-hidden transition relative group">
                    {editAvatar ? (
                      <img src={URL.createObjectURL(editAvatar)} alt="Clan" className="w-full h-full object-cover" />
                    ) : myClan?.clan_avatar ? (
                      <img src={myClan.clan_avatar} alt="Clan" className="w-full h-full object-cover opacity-50 group-hover:opacity-30 transition" />
                    ) : (
                      <CameraIcon size={24} className="text-gray-400 group-hover:text-[#ccff00]" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition">
                       <PencilIcon size={24} className="text-white" />
                    </div>
                  </div>
                  <input type="file" accept="image/*" ref={editFileInputRef} onChange={(e) => setEditAvatar(e.target.files?.[0] || null)} className="hidden" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1">Clan Name</label>
                  <input required value={editName} onChange={e => setEditName(e.target.value)} maxLength={20} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 font-bold block mb-1">Clan Tag</label>
                  <input required value={editTag} onChange={e => setEditTag(e.target.value)} maxLength={4} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl uppercase" />
                </div>
                <button disabled={uploading} className="w-full bg-[#ccff00] text-black font-bold py-3 rounded-xl hover:bg-white transition disabled:opacity-50 mt-2">
                  {uploading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* CLAN DETAILS MODAL */}
        {viewingClan && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f1014] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative animate-in zoom-in-95">
              <div className="p-5 border-b border-white/10 bg-black/40 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black/50 border border-white/10 rounded-xl flex items-center justify-center font-bold text-[#ccff00] overflow-hidden shrink-0">
                     {viewingClan.clan_avatar ? <img src={viewingClan.clan_avatar} alt="" className="w-full h-full object-cover" /> : viewingClan.clan_tag}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white">{viewingClan.clan_name}</h2>
                    <p className="text-xs text-gray-400 font-mono">[{viewingClan.clan_tag}]</p>
                  </div>
                </div>
                <button onClick={() => setViewingClan(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-gray-400 hover:text-white self-start">
                  <XIcon weight="bold" size={20} />
                </button>
              </div>
              
              <div className="max-h-[60vh] overflow-y-auto p-2 admin-custom-scrollbar">
                {loadingMembers ? (
                  <div className="text-center py-10 text-gray-400 text-sm animate-pulse">Loading members...</div>
                ) : clanMembers.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm">No members found.</div>
                ) : (
                  clanMembers.map((member, i) => {
                    const memberBorder = member.user_inventory?.find(
                      (inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'avatar_border'
                    )

                    return (
                      <div 
                        key={member.id} 
                        onClick={() => {
                          setViewingClan(null);
                          navigate('/player/' + member.id);
                        }}
                        className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-gray-500 w-4">{i + 1}</span>
                          
                          <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
                            <div className="absolute inset-[15%] rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-400 z-10">
                              {member.avatar_url ? <img src={member.avatar_url} alt="" className="w-full h-full object-cover" /> : member.display_name?.charAt(0)}
                            </div>
                            {memberBorder?.cosmetic_items?.preview_url && (
                              <img src={memberBorder.cosmetic_items.preview_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                            )}
                          </div>

                          <p className="font-bold text-sm text-white group-hover:text-[#ccff00] transition">{member.display_name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xs font-bold text-[#ccff00]">{member.points} pts</p>
                          <CaretRightIcon weight="bold" className="text-gray-500 group-hover:text-white transition" />
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
              <div className="p-4 border-t border-white/10 bg-black/20 text-center">
                {/* 🔧 FIXED: Added fallback (viewingClan.total_points || 0) to prevent crash */}
                <p className="text-xs text-gray-400">Total Clan Points: <span className="font-bold text-[#ccff00]">{(viewingClan.total_points || 0).toLocaleString()}</span></p>
              </div>
            </div>
          </div>
        )}

               {/* CONFIRMATION MODAL */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#0f1014] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-in zoom-in-95 p-6 text-center">
              
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                confirmModal.type === 'delete' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'
              }`}>
                {confirmModal.type === 'delete' ? (
                  <TrashIcon weight="fill" className="w-8 h-8" />
                ) : (
                  <WarningCircleIcon weight="fill" className="w-8 h-8" />
                )}
              </div>

              <h2 className="text-xl font-black text-white mb-2">
                {confirmModal.type === 'delete' ? 'Delete Clan?' : 'Leave Clan?'}
              </h2>
              
              <p className="text-gray-400 text-sm mb-6">
                {confirmModal.type === 'delete' 
                  ? "You are the Leader. If you leave, the clan will be permanently DELETED for everyone. Are you sure?" 
                  : "Are you sure you want to leave this clan? You will lose your access to the clan chat and your points will no longer count towards the clan total."}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal({ isOpen: false, type: null })}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={executeLeaveClan}
                  className={`flex-1 py-3 rounded-xl font-bold transition text-sm shadow-lg ${
                    confirmModal.type === 'delete'
                      ? 'bg-red-500 text-white hover:bg-red-400 shadow-red-500/20'
                      : 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-yellow-500/20'
                  }`}
                >
                  {confirmModal.type === 'delete' ? 'Delete Clan' : 'Leave Clan'}
                </button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}