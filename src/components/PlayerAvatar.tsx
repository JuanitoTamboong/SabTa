import '../css/PlayerAvatar.css'

type PlayerAvatarProps = {
  avatarUrl?: string | null
  borderUrl?: string | null
  displayName?: string | null
  className?: string
  loading?: boolean
}

export default function PlayerAvatar({
  avatarUrl,
  borderUrl,
  displayName,
  className = '',
  loading = false,
}: PlayerAvatarProps) {
  const name = displayName?.trim() || 'Player'

  return (
    <div
      className={`player-avatar ${className}`}
      role="img"
      aria-label={loading ? 'Uploading avatar' : `${name}'s avatar${borderUrl ? ' with equipped border' : ''}`}
    >
      <div className="player-avatar__photo">
        {loading ? (
          <span className="player-avatar__loading">Uploading...</span>
        ) : avatarUrl ? (
          <img src={avatarUrl} alt="" />
        ) : (
          <span>{name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      {borderUrl && <img className="player-avatar__frame" src={borderUrl} alt="" />}
    </div>
  )
}
