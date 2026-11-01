import sabtaLogo from '../assets/icons/sabta-logo.png'

type LoadingScreenProps = {
  title: string
  subtitle: string
}

type LoadingIndicatorProps = {
  label: string
  className?: string
}

export function LoadingIndicator({
  label,
  className = '',
}: LoadingIndicatorProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`sab-loading-indicator ${className}`}
    >
      <span className="sab-loading-indicator__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export default function LoadingScreen({ title, subtitle }: LoadingScreenProps) {
  return (
    <main className="sab-loading-screen" role="status" aria-live="polite">
      <div className="sab-loading-screen__content">
        <div className="sab-loading-emblem" aria-hidden="true">
          <span className="sab-loading-emblem__orbit" />
          <img src={sabtaLogo} alt="" />
          <span className="sab-loading-emblem__spark" />
        </div>
        <p className="sab-loading-title">{title}</p>
        <p className="sab-loading-subtitle">{subtitle}</p>
        <span className="sab-loading-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </main>
  )
}
