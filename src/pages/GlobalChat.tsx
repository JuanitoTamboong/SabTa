// src/components/GlobalChat.tsx
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  ChatCircleDotsIcon, XIcon, PaperPlaneRightIcon, 
  UserIcon, TrashIcon 
} from '@phosphor-icons/react'
import { fetchAllBadges, getPlayerBadge, type BadgeInfo } from '../lib/badges'

export default function GlobalChat() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [sending, setSending] = useState(false)
  const [onlineCount, setOnlineCount] = useState(1) 
  const [unreadCount, setUnreadCount] = useState(0)
  
  // 🔧 REACTIONS STATE
  const [showReactionMenu, setShowReactionMenu] = useState<string | null>(null)
  const [messageReactions, setMessageReactions] = useState<Record<string, any[]>>({})

  // 🔧 Badge State
  const [allBadges, setAllBadges] = useState<BadgeInfo[]>([])

  const isOpenRef = useRef(isOpen)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    isOpenRef.current = isOpen
    if (isOpen) {
      setUnreadCount(0)
    }
  }, [isOpen])

  useEffect(() => {
    let isMounted = true
    let channel: any = null

    const initChat = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted) return
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (isMounted) setCurrentUser(profile)

      const badgesData = await fetchAllBadges()
      if (isMounted) setAllBadges(badgesData)

      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      // Fetch messages AND their reactions
      const { data } = await supabase
        .from('chat_messages')
        .select(`
          id, message, created_at, user_id,
          profiles ( display_name, avatar_url, points, user_inventory ( is_equipped, cosmetic_items ( preview_url, cosmetic_type ) ) ),
          chat_reactions ( id, user_id, emoji )
        `)
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: true })
        .limit(50)

      if (data && isMounted) {
        setMessages(data)
        
        // Group reactions by message ID
        const reactionsMap: Record<string, any[]> = {}
        data.forEach(msg => {
          if (msg.chat_reactions) reactionsMap[msg.id] = msg.chat_reactions
        })
        setMessageReactions(reactionsMap)
        
        setTimeout(scrollToBottom, 100)
      }

      channel = supabase
        .channel('global_chat_room', {
          config: { presence: { key: user.id } },
        })
        .on(
          'postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'chat_messages' }, 
          async (payload: any) => {
            const { data: newMsg } = await supabase
              .from('chat_messages')
              .select(`
                id, message, created_at, user_id,
                profiles ( display_name, avatar_url, points, user_inventory ( is_equipped, cosmetic_items ( preview_url, cosmetic_type ) ) ),
                chat_reactions ( id, user_id, emoji )
              `)
              .eq('id', payload.new.id)
              .single()

            if (newMsg && isMounted) {
              setMessages((prev) => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg]
              })

              if (!isOpenRef.current && newMsg.user_id !== user.id) {
                setUnreadCount(prev => prev + 1)
              }
              
              const container = scrollContainerRef.current
              if (container) {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
                if (isNearBottom) setTimeout(scrollToBottom, 100)
              }
            }
          }
        )
        // 🔧 Listen for new/updated reactions in real-time
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'chat_reactions' },
          async () => {
            const { data: reactionsData } = await supabase
              .from('chat_reactions')
              .select('*')
            
            if (reactionsData && isMounted) {
              const reactionsMap: Record<string, any[]> = {}
              reactionsData.forEach(rx => {
                if (!reactionsMap[rx.message_id]) reactionsMap[rx.message_id] = []
                reactionsMap[rx.message_id].push(rx)
              })
              setMessageReactions(reactionsMap)
            }
          }
        )
        .on('presence', { event: 'sync' }, () => {
          const state = channel?.presenceState() || {}
          const uniqueUserIds = new Set()
          Object.values(state).forEach((presences: any) => {
            presences.forEach((p: any) => {
              if (p.user_id) uniqueUserIds.add(p.user_id)
            })
          })
          const count = Math.max(1, uniqueUserIds.size)
          if (isMounted) setOnlineCount(count)
        })
        .subscribe(async (status: string) => {
          if (status === 'SUBSCRIBED' && isMounted) {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            })
          }
        })
    }

    initChat()

    return () => {
      isMounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, []) 

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUser || sending) return

    setSending(true)
    const msgText = newMessage.trim()
    setNewMessage('')

    try {
      await supabase.from('chat_messages').insert({
        user_id: currentUser.id,
        message: msgText
      })
    } catch (err) {
      console.error("Failed to send message", err)
      setNewMessage(msgText)
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this message?')) return
    await supabase.from('chat_messages').delete().eq('id', id)
    setMessages((prev) => prev.filter(m => m.id !== id))
  }

  // 🔧 Handle Reaction Click (Toggle on/off & save to DB)
  const handleReaction = async (msgId: string, emoji: string) => {
    setShowReactionMenu(null) // Close menu immediately
    if (!currentUser) return

    const existingReactions = messageReactions[msgId] || []
    const myReaction = existingReactions.find(r => r.user_id === currentUser.id)

    if (myReaction) {
      if (myReaction.emoji === emoji) {
        // Click same emoji to remove it
        await supabase.from('chat_reactions').delete().eq('id', myReaction.id)
      } else {
        // Click different emoji to update it
        await supabase.from('chat_reactions').update({ emoji }).eq('id', myReaction.id)
      }
    } else {
      // New reaction
      await supabase.from('chat_reactions').insert({
        message_id: msgId,
        user_id: currentUser.id,
        emoji
      })
    }
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[90] bg-[#ccff00] text-black p-4 rounded-full shadow-[0_0_20px_rgba(204,255,0,0.4)] hover:scale-110 transition-transform ${isOpen ? 'hidden' : 'flex'}`}
      >
        <ChatCircleDotsIcon weight="fill" className="w-7 h-7" />
        
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-[#0f1014] flex items-center justify-center shadow-lg animate-in zoom-in">
            <span className="text-[10px] font-black text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </div>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[100] w-[calc(100vw-2rem)] sm:w-96 h-[500px] max-h-[70vh] bg-[#0f1014] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          
          <div className="flex items-center justify-between p-4 bg-black/40 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ChatCircleDotsIcon weight="fill" className="text-[#ccff00] w-6 h-6" />
              <h3 className="font-bold text-white">Global Chat</h3>
              
              <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-2 py-0.5 rounded-full ml-1">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-green-400">{onlineCount} Online</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white bg-white/5 p-1.5 rounded-lg transition">
              <XIcon weight="bold" size={18} />
            </button>
          </div>

          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 admin-custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm mt-10">No recent messages. Say hello!</div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.user_id === currentUser?.id
                
                const equippedBorder = msg.profiles?.user_inventory?.find(
                  (inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'avatar_border'
                )?.cosmetic_items?.preview_url

                const senderBadge = getPlayerBadge(msg.profiles?.points || 0, allBadges)
                
                const reactionsForMsg = messageReactions[msg.id] || []
                const reactionCounts = reactionsForMsg.reduce((acc: any, curr: any) => {
                  acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
                  return acc;
                }, {});

                // Check if I reacted to this message
                const myReaction = reactionsForMsg.find(r => r.user_id === currentUser?.id)

                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    <div 
                      onClick={() => { if (!isMe) navigate(`/player/${msg.user_id}`) }}
                      className={`relative w-8 h-8 flex items-center justify-center shrink-0 mt-1 ${!isMe ? 'cursor-pointer group' : ''}`}
                      title={!isMe ? `View ${msg.profiles?.display_name}'s profile` : 'You'}
                    >
                      <div className="absolute inset-[15%] rounded-full bg-white/10 flex items-center justify-center overflow-hidden z-10 border border-white/10 group-hover:border-[#ccff00] transition">
                        {msg.profiles?.avatar_url ? (
                          <img src={msg.profiles.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <UserIcon className="w-4 h-4 text-gray-400" />
                        )}
                      </div>

                      {equippedBorder && (
                        <img 
                          src={equippedBorder} 
                          className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" 
                        />
                      )}

                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#0f1014] rounded-full z-30 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                    </div>

                    <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span 
                          onClick={() => { if (!isMe) navigate(`/player/${msg.user_id}`) }}
                          className={`text-[10px] text-gray-400 font-bold ${!isMe ? 'cursor-pointer hover:text-[#ccff00] transition' : ''}`}
                        >
                          {msg.profiles?.display_name || 'Player'}
                        </span>
                        
                        {senderBadge && (
                          <img 
                            src={senderBadge.image_url} 
                            alt={senderBadge.name} 
                            title={senderBadge.name}
                            className="w-3.5 h-3.5 object-contain" 
                          />
                        )}

                        <span className="text-[9px] text-gray-600">{formatTime(msg.created_at)}</span>
                      </div>

                      <div className="relative group">
                        
                        {/* 🔧 Invisible overlay to close the menu when clicking outside */}
                        {showReactionMenu === msg.id && (
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setShowReactionMenu(null)}
                          />
                        )}

                        {/* The Reaction Menu Popup */}
                        {showReactionMenu === msg.id && (
                          <div className={`absolute -top-12 bg-[#1a1c23] border border-white/10 rounded-full px-2 py-1 flex gap-1 shadow-xl z-50 animate-in zoom-in-95 ${isMe ? 'right-0' : 'left-0'}`}>
                            {['👍', '😂', '❤️', '😢', '😮', '😡'].map(emoji => (
                              <button 
                                key={emoji} 
                                onClick={() => handleReaction(msg.id, emoji)}
                                className={`hover:scale-125 hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center transition text-lg ${myReaction?.emoji === emoji ? 'bg-white/20 scale-110' : ''}`}
                              >
                                {emoji}
                              </button>
                            ))}
                            <button className="hover:scale-125 hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center transition text-gray-400 font-bold text-xl">
                              +
                            </button>
                          </div>
                        )}

                        <div 
                          // 🔧 PRESS AND HOLD LOGIC
                          onMouseDown={(e) => {
                            const target = e.currentTarget;
                            target.dataset.timer = setTimeout(() => {
                              setShowReactionMenu(showReactionMenu === msg.id ? null : msg.id);
                            }, 500)?.toString();
                          }}
                          onMouseUp={(e) => clearTimeout(Number(e.currentTarget.dataset.timer))}
                          onMouseLeave={(e) => clearTimeout(Number(e.currentTarget.dataset.timer))}
                          onTouchStart={(e) => {
                            const target = e.currentTarget;
                            target.dataset.timer = setTimeout(() => {
                              setShowReactionMenu(showReactionMenu === msg.id ? null : msg.id);
                            }, 500)?.toString();
                          }}
                          onTouchEnd={(e) => clearTimeout(Number(e.currentTarget.dataset.timer))}

                          className={`relative flex items-center rounded-2xl text-sm cursor-pointer select-none ${
                          isMe 
                            ? 'bg-[#ccff00] text-black rounded-tr-none pl-3 pr-8 py-2' 
                            : 'bg-white/10 text-white rounded-tl-none px-3 py-2'
                        }`}>
                          <span className="break-words">{msg.message}</span>
                          
                          {isMe && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDelete(msg.id) }}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-red-500 hover:text-red-700 transition"
                              title="Delete message"
                            >
                              <TrashIcon size={14} weight="bold" />
                            </button>
                          )}
                        </div>

                        {/* Display Reaction Badges */}
                        {Object.keys(reactionCounts).length > 0 && (
                          <div className={`absolute -bottom-3 flex gap-1 ${isMe ? 'right-2' : 'left-2'} z-20`}>
                            {Object.entries(reactionCounts).map(([emoji, count]) => {
                              // Check if *I* am one of the people who reacted with this emoji
                              const iReacted = reactionsForMsg.some(r => r.emoji === emoji && r.user_id === currentUser?.id)
                              
                              return (
                                <button 
                                  key={emoji}
                                  onClick={() => handleReaction(msg.id, emoji)} // Clicking the badge toggles it
                                  className={`bg-[#1a1c23] border rounded-full px-1.5 py-0.5 text-xs shadow-md flex items-center gap-1 transition ${
                                    iReacted ? 'border-[#ccff00]' : 'border-white/10'
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span className="text-[9px] text-gray-400 font-bold">{(count as number) > 1 ? count : ''}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-black/40 border-t border-white/10 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
              className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#ccff00] transition"
            />
            <button 
              type="submit" 
              disabled={!newMessage.trim() || sending}
              className="bg-[#ccff00] text-black p-2.5 rounded-xl font-bold hover:bg-white transition disabled:opacity-50"
            >
              <PaperPlaneRightIcon weight="fill" className="w-5 h-5" />
            </button>
          </form>

        </div>
      )}
    </>
  )
}