import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, BellRing, Info, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Announcement = {
  id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'urgent'
  is_active: boolean
  published_at: string
  ends_at: string | null
}

function isAnnouncement(value: unknown): value is Announcement {
  if (!value || typeof value !== 'object') return false

  const announcement = value as Record<string, unknown>
  return (
    typeof announcement.id === 'string' &&
    typeof announcement.title === 'string' &&
    typeof announcement.message === 'string' &&
    (announcement.severity === 'info' ||
      announcement.severity === 'warning' ||
      announcement.severity === 'urgent') &&
    typeof announcement.is_active === 'boolean' &&
    typeof announcement.published_at === 'string' &&
    (announcement.ends_at === null || typeof announcement.ends_at === 'string')
  )
}

function isCurrentlyActive(announcement: Announcement) {
  return (
    announcement.is_active &&
    (!announcement.ends_at || new Date(announcement.ends_at).getTime() > Date.now())
  )
}

const SEVERITY_STYLES = {
  info: {
    label: 'Announcement',
    color: 'text-cyan-300',
    border: 'border-cyan-400/30',
    background: 'bg-cyan-400/10',
    Icon: Info,
  },
  warning: {
    label: 'Important notice',
    color: 'text-amber-300',
    border: 'border-amber-400/30',
    background: 'bg-amber-400/10',
    Icon: AlertTriangle,
  },
  urgent: {
    label: 'Urgent announcement',
    color: 'text-rose-300',
    border: 'border-rose-400/30',
    background: 'bg-rose-400/10',
    Icon: BellRing,
  },
}

export default function AnnouncementModal() {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null)
  const revision = useRef(0)

  useEffect(() => {
    let isMounted = true

    const fetchLatestAnnouncement = async () => {
      const currentRevision = revision.current
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, message, severity, is_active, published_at, ends_at')
        .eq('is_active', true)
        .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
        .order('published_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Failed to load player announcement:', error)
        return
      }

      if (!isMounted || revision.current !== currentRevision) return
      if (data && isAnnouncement(data)) setAnnouncement(data)
    }

    const channel = supabase
      .channel('player-announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        (payload) => {
          revision.current += 1

          if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            setAnnouncement((current) => current?.id === deletedId ? null : current)
            return
          }

          if (!isAnnouncement(payload.new)) return

          if (isCurrentlyActive(payload.new)) {
            setAnnouncement(payload.new)
          } else {
            setAnnouncement((current) => current?.id === payload.new.id ? null : current)
          }
        }
      )
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('Player announcement realtime subscription failed:', error)
        }
      })

    void fetchLatestAnnouncement()

    return () => {
      isMounted = false
      void supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!announcement?.ends_at) return

    const remaining = new Date(announcement.ends_at).getTime() - Date.now()
    if (remaining <= 0) return

    const timeout = window.setTimeout(() => setAnnouncement(null), remaining)
    return () => window.clearTimeout(timeout)
  }, [announcement])

  if (!announcement) return null

  const style = SEVERITY_STYLES[announcement.severity]
  const SeverityIcon = style.Icon
  const dismiss = () => setAnnouncement(null)

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-announcement-title"
        className={`relative w-full max-w-lg overflow-hidden rounded-3xl border ${style.border} bg-[#101114] shadow-2xl`}
      >
        <div className={`flex items-center justify-between border-b border-white/10 px-6 py-5 ${style.background}`}>
          <div className={`flex items-center gap-3 ${style.color}`}>
            <SeverityIcon aria-hidden="true" className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">
              {style.label}
            </span>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close announcement"
            className="rounded-lg p-2 text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-7">
          <h2
            id="player-announcement-title"
            className="text-2xl font-black leading-tight text-white sm:text-3xl"
          >
            {announcement.title}
          </h2>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-gray-300 sm:text-base">
            {announcement.message}
          </p>
          <p className="mt-5 text-xs text-gray-500">
            {new Date(announcement.published_at).toLocaleString()}
          </p>
        </div>

        <div className="flex justify-end border-t border-white/10 px-6 py-4">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-xl bg-[#ccff00] px-5 py-2.5 text-sm font-bold text-black transition hover:bg-white"
          >
            Got it
          </button>
        </div>
      </section>
    </div>
  )
}
