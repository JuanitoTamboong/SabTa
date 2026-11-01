import { useEffect, useState, type ReactNode } from 'react'

type ModalPresenceProps = {
  open: boolean
  children: ReactNode
  mode?: 'modal' | 'panel'
  className: string
  panelClassName?: string
}

export default function ModalPresence({
  open,
  children,
  mode = 'modal',
  className,
  panelClassName = '',
}: ModalPresenceProps) {
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const [retainedChildren, setRetainedChildren] = useState(children)

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => setRetainedChildren(children))
    return () => window.cancelAnimationFrame(frame)
  }, [children, open])

  useEffect(() => {
    let frame = 0
    let timeout = 0

    if (open) {
      frame = window.requestAnimationFrame(() => setVisible(true))
    } else {
      frame = window.requestAnimationFrame(() => setVisible(false))
      timeout = window.setTimeout(() => setMounted(false), 240)
    }

    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [open])

  if (!mounted && !open) return null

  const content = open ? children : retainedChildren

  if (mode === 'panel') {
    return (
      <div
        aria-hidden={!visible}
        className={`sab-presence-chat ${visible ? 'is-visible' : ''} ${className}`}
      >
        {content}
      </div>
    )
  }

  return (
    <div
      aria-hidden={!visible}
      className={`sab-presence-backdrop ${visible ? 'is-visible' : ''} ${className}`}
    >
      <div className={`sab-presence-modal ${visible ? 'is-visible' : ''} ${panelClassName}`}>
        {content}
      </div>
    </div>
  )
}
