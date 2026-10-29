// src/components/GlobalChat.tsx
import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { 
  ChatCircleDotsIcon, XIcon, PaperPlaneRightIcon, 
  UserIcon, TrashIcon 
} from '@phosphor-icons/react'

export default function GlobalChat() {
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [sending, setSending] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    let channel: any = null

    const initChat = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setCurrentUser(profile)

      // ✅ 24-HOUR FILTER: Only fetch messages from the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data } = await supabase
        .from('chat_messages')
        .select(`
          id, message, created_at, user_id,
          profiles ( display_name, avatar_url )
        `)
        .gte('created_at', twentyFourHoursAgo) // The filter
        .order('created_at', { ascending: true })
        .limit(50)

      if (data) {
        setMessages(data)
        setTimeout(scrollToBottom, 100)
      }

      // Unique channel name prevents StrictMode double-mount errors
      const channelName = `chat_room_${Date.now()}_${Math.random().toString(36).substring(7)}`

      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'chat_messages' }, 
          async (payload) => {
            const { data: newMsg } = await supabase
              .from('chat_messages')
              .select(`id, message, created_at, user_id, profiles ( display_name, avatar_url )`)
              .eq('id', payload.new.id)
              .single()

            if (newMsg) {
              setMessages((prev) => {
                if (prev.some(m => m.id === newMsg.id)) return prev;
                return [...prev, newMsg]
              })
              
              const container = scrollContainerRef.current
              if (container) {
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
                if (isNearBottom) setTimeout(scrollToBottom, 100)
              }
            }
          }
        )
        .subscribe()
    }

    initChat()

    return () => {
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

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* FLOATING BUTTON */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[90] bg-[#ccff00] text-black p-4 rounded-full shadow-[0_0_20px_rgba(204,255,0,0.4)] hover:scale-110 transition-transform ${isOpen ? 'hidden' : 'flex'}`}
      >
        <ChatCircleDotsIcon weight="fill" className="w-7 h-7" />
      </button>

      {/* CHAT WINDOW */}
      {isOpen && (
        <div className="fixed bottom-20 lg:bottom-6 right-4 lg:right-6 z-[100] w-[calc(100vw-2rem)] sm:w-96 h-[500px] max-h-[70vh] bg-[#0f1014] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-200">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-black/40 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ChatCircleDotsIcon weight="fill" className="text-[#ccff00] w-6 h-6" />
              <h3 className="font-bold text-white">Global Chat</h3>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white bg-white/5 p-1.5 rounded-lg transition">
              <XIcon weight="bold" size={18} />
            </button>
          </div>

          {/* Messages Area */}
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4 admin-custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 text-sm mt-10">No recent messages. Say hello!</div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.user_id === currentUser?.id
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    
                    {/* ✅ Avatar with Online Indicator & Click to View Profile */}
                    <div 
                      onClick={() => { if (!isMe) navigate(`/player/${msg.user_id}`) }}
                      className={`relative w-8 h-8 rounded-full bg-white/10 shrink-0 flex items-center justify-center overflow-hidden border border-white/10 mt-1 ${!isMe ? 'cursor-pointer hover:border-[#ccff00] transition' : ''}`}
                      title={!isMe ? `View ${msg.profiles?.display_name}'s profile` : 'You'}
                    >
                      {msg.profiles?.avatar_url ? (
                        <img src={msg.profiles.avatar_url} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-gray-400" />
                      )}
                      
                      {/* Green Online Dot */}
                      <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#0f1014] rounded-full z-10 shadow-[0_0_5px_rgba(34,197,94,0.5)]" />
                    </div>

                    {/* Message Bubble */}
                    <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        {/* ✅ Clickable Name */}
                        <span 
                          onClick={() => { if (!isMe) navigate(`/player/${msg.user_id}`) }}
                          className={`text-[10px] text-gray-400 font-bold ${!isMe ? 'cursor-pointer hover:text-[#ccff00] transition' : ''}`}
                        >
                          {msg.profiles?.display_name || 'Player'}
                        </span>
                        <span className="text-[9px] text-gray-600">{formatTime(msg.created_at)}</span>
                      </div>
                      <div className={`px-3 py-2 rounded-2xl text-sm relative group ${
                        isMe 
                          ? 'bg-[#ccff00] text-black rounded-tr-none' 
                          : 'bg-white/10 text-white rounded-tl-none'
                      }`}>
                        {msg.message}
                        
                        {/* Delete Button */}
                        {isMe && (
                          <button 
                            onClick={() => handleDelete(msg.id)}
                            className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition p-1"
                            title="Delete message"
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
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