// src/pages/Leaderboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import {
  TrophyIcon, LightningIcon, SignOutIcon, HouseIcon,
  GameControllerIcon, ShoppingBagIcon, UserIcon,
  MedalIcon, CrownIcon, TimerIcon, GlobeIcon,
  ShieldIcon 
} from '@phosphor-icons/react'
import { fetchAllBadges, getPlayerBadge, type BadgeInfo } from '../lib/badges'
import sabtaLogo from '../assets/icons/sabta-logo.png'
import PlayerAvatar from '../components/PlayerAvatar'
import '../css/Leaderboard.css'

type LeaderboardPlayer = {
  id: string
  display_name: string
  avatar_url: string | null
  age_category: string | null
  points: number
  bestTime: number
  coins: number
  createdAt: string
  border_url: string | null
}

export default function Leaderboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([])
  const [activeTab, setActiveTab] = useState<'global' | 'normal' | 'intermediate' | 'hard'>('global')
  
  const [allBadges, setAllBadges] = useState<BadgeInfo[]>([])
  const [equippedBackground, setEquippedBackground] = useState<string | null>(null)

  const formatTime = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds === 99999 || totalSeconds === 9999) return null
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
  }

  useEffect(() => {
    let isActive = true
    let canViewLeaderboard = false
    let ageCategory: string | null = null

    const fetchLeaderboardRows = async (showLoading = false) => {
      if (showLoading) setLoading(true)
      setLoadError(null)

      const { data: leaderboardRows, error: leaderboardError } = await supabase.rpc(
        'get_season_leaderboard',
        { p_age_category: ageCategory }
      )

      if (!isActive) return

      if (leaderboardError) {
        console.error('Failed to load leaderboard:', leaderboardError)
        setLoadError('Unable to load rankings right now. Please try again later.')
        setPlayers([])
        if (showLoading) setLoading(false)
        return
      }

      const playerStats: LeaderboardPlayer[] = (leaderboardRows || []).map((row: any): LeaderboardPlayer => {
        const points = activeTab === 'global'
          ? row.points
          : row[`${activeTab}_points`]
        const bestTime = activeTab === 'global'
          ? row.best_time
          : row[`${activeTab}_best_time`]

        return {
          id: row.id,
          display_name: row.display_name,
          avatar_url: row.avatar_url,
          age_category: row.age_category,
          points,
          bestTime,
          coins: row.coins,
          createdAt: row.created_at,
          border_url: row.border_url,
        }
      })
        .filter((player: LeaderboardPlayer) => player.points > 0)
        .sort((a: LeaderboardPlayer, b: LeaderboardPlayer) =>
          b.points - a.points ||
          a.bestTime - b.bestTime ||
          b.coins - a.coins ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        )

      setPlayers(playerStats)
      if (showLoading) setLoading(false)
    }

    const fetchLeaderboard = async () => {
      setLoading(true)
      setLoadError(null)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')
      if (!isActive) return

      const badgesData = await fetchAllBadges()
      if (!isActive) return
      setAllBadges(badgesData)

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (!isActive) return
      if (profileData) setProfile(profileData)

      // 🔧 FIX 1: Allow Admins to view even if they don't have an age_category
      if (!profileData?.age_category && profileData?.role !== 'admin') { setLoading(false); return }
      canViewLeaderboard = true

      const { data: myInventory } = await supabase
        .from('user_inventory')
        .select('is_equipped, cosmetic_items(cosmetic_type, preview_url)')
        .eq('user_id', user.id)
        .eq('is_equipped', true)

      if (!isActive) return
      if (myInventory) {
        const bg = myInventory.find(i => (i.cosmetic_items as any)?.cosmetic_type === 'background')
        if (bg && (bg.cosmetic_items as any)?.preview_url) {
          setEquippedBackground((bg.cosmetic_items as any).preview_url)
        }
      }

      const selectedAgeCategory = activeTab !== 'global' && profileData?.role !== 'admin'
        ? profileData?.age_category
        : null
      ageCategory = selectedAgeCategory
      await fetchLeaderboardRows(true)
    }

    const channel = supabase
      .channel('leaderboard-profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          if (canViewLeaderboard) void fetchLeaderboardRows()
        }
      )
      .subscribe()

    void fetchLeaderboard()

    return () => {
      isActive = false
      void supabase.removeChannel(channel)
    }
  }, [navigate, activeTab])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return <LoadingScreen title="Loading the leaderboard" subtitle="Bringing the latest arena rankings into view." />
  }

  const currentUserRank = players.findIndex(p => p.id === profile?.id) + 1
  const currentUser = players.find(player => player.id === profile?.id)
  const currentUserPoints = currentUser?.points ?? 0

  const tabOptions = [
    { id: 'global' as const, label: 'Global', icon: <GlobeIcon weight="bold" /> },
    { id: 'normal' as const, label: 'Normal', icon: null },
    { id: 'intermediate' as const, label: 'Intermediate', icon: null },
    { id: 'hard' as const, label: 'Hard', icon: null },
  ]

  const renderPlayerBadge = (points: number, size = 'leaderboard-badge') => {
    const badge = getPlayerBadge(points, allBadges)
    return badge ? <img className={size} src={badge.image_url} alt={badge.name} title={badge.name} /> : null
  }

  const renderPodiumPlayer = (player: LeaderboardPlayer | undefined, place: 1 | 2 | 3) => {
    if (!player) return <div className={`leaderboard-podium-slot leaderboard-podium-slot--${place}`} aria-hidden="true" />

    return (
      <button
        type="button"
        key={player.id}
        className={`leaderboard-podium-player leaderboard-podium-player--${place}`}
        onClick={() => navigate(`/player/${player.id}`)}
        aria-label={`View ${player.display_name}, rank ${place}`}
      >
        <div className="leaderboard-podium-avatar-wrap">
          {place === 1 && <CrownIcon className="leaderboard-crown" weight="fill" />}
          <PlayerAvatar
            className="leaderboard-podium-avatar"
            avatarUrl={player.avatar_url}
            borderUrl={player.border_url}
            displayName={player.display_name}
          />
          <span className="leaderboard-podium-rank">{place}</span>
        </div>
        <div className="leaderboard-podium-card">
          <span className="leaderboard-podium-title">{place === 1 ? 'CHAMPION' : place === 2 ? 'RUNNER UP' : 'THIRD PLACE'}</span>
          <span className="leaderboard-podium-name">{player.display_name}</span>
          {renderPlayerBadge(player.points, 'leaderboard-badge leaderboard-podium-badge')}
          {activeTab === 'global' && <span className="leaderboard-podium-tier">{player.age_category || 'PLAYER'}</span>}
          <span className="leaderboard-podium-points"><LightningIcon weight="fill" /> {player.points.toLocaleString()} <small>PTS</small></span>
        </div>
      </button>
    )
  }

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-ambient" aria-hidden="true" />
      {equippedBackground && (
        <div className="leaderboard-cosmetic-bg" aria-hidden="true">
          <img src={equippedBackground} alt="" />
        </div>
      )}

      <aside className="leaderboard-sidebar">
        <button className="leaderboard-brand" onClick={() => navigate('/dashboard')} aria-label="SabTa home">
          <span className="leaderboard-brand__mark"><img src={sabtaLogo} alt="" /></span>
          <span className="leaderboard-brand__word">SAB<span>TA</span><small>PLAYER ARENA</small></span>
        </button>
        <span className="leaderboard-sidebar__label">MENU</span>
        <nav className="leaderboard-nav" aria-label="Main navigation">
          <button onClick={() => navigate('/dashboard')}><HouseIcon weight="fill" /><span>Overview</span></button>
          <button onClick={() => navigate('/quizzes')}><GameControllerIcon weight="fill" /><span>Play quiz</span></button>
          <button className="is-active" aria-current="page"><TrophyIcon weight="fill" /><span>Leaderboard</span></button>
          <button onClick={() => navigate('/clans')}><ShieldIcon weight="fill" /><span>Clans</span></button>
          <button onClick={() => navigate('/rewards')}><ShoppingBagIcon weight="fill" /><span>Rewards shop</span></button>
          <button onClick={() => navigate('/profile')}><UserIcon weight="fill" /><span>My profile</span></button>
        </nav>
        <button className="leaderboard-logout" onClick={handleLogout}><SignOutIcon weight="fill" /> Log out</button>
      </aside>

      <main className="leaderboard-main">
        <header className="leaderboard-topbar">
          <button className="leaderboard-brand leaderboard-brand--mobile" onClick={() => navigate('/dashboard')} aria-label="SabTa home">
            <span className="leaderboard-brand__mark"><img src={sabtaLogo} alt="" /></span>
            <span className="leaderboard-brand__word">SAB<span>TA</span></span>
          </button>
          <div className="leaderboard-breadcrumb"><span>PLAYER HUB</span><i>/</i> LEADERBOARD</div>
          <div className="leaderboard-topbar__right">
            <span className="leaderboard-points"><LightningIcon weight="fill" /> <strong>{currentUserPoints.toLocaleString()}</strong><small>{activeTab === 'global' ? 'SEASON PTS' : `${activeTab.toUpperCase()} PTS`}</small></span>
            <button className="leaderboard-topbar__logout" onClick={handleLogout} aria-label="Log out"><SignOutIcon weight="bold" /></button>
          </div>
        </header>

        <div className="leaderboard-content">
          <section className="leaderboard-hero">
            <div className="leaderboard-hero__copy">
              <span className="leaderboard-kicker"><span /> SEASON ARENA</span>
              <h1>Legends are<br /><span>made here.</span></h1>
              <p>{activeTab === 'global' ? 'The season standings. Every tier, every player, one arena.' : `See who's leading the ${profile?.age_category || 'player'} tier in ${activeTab}.`}</p>
            </div>
            <div className="leaderboard-hero__stat">
              <span><TrophyIcon weight="fill" /> ACTIVE RANKINGS</span>
              <strong>{players.length.toLocaleString()}</strong>
              <small>PLAYERS ON THE BOARD</small>
            </div>
          </section>

          <section className="leaderboard-controls" aria-label="Leaderboard filters">
            <div className="leaderboard-controls__heading"><span>RANKINGS</span><small>Choose your arena</small></div>
            <div className="leaderboard-tabs" role="tablist" aria-label="Leaderboard category">
              {tabOptions.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={activeTab === tab.id ? 'is-active' : ''}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>
            <div className="leaderboard-controls__season"><span /> SEASON LIVE</div>
          </section>

          {loadError ? (
            <section className="leaderboard-state leaderboard-state--error">
              <TrophyIcon weight="duotone" />
              <strong>Rankings unavailable</strong>
              <p>{loadError}</p>
            </section>
          ) : players.length === 0 ? (
            <section className="leaderboard-state">
              <span className="leaderboard-state__icon"><TrophyIcon weight="duotone" /></span>
              <span className="leaderboard-kicker">THE ARENA IS OPEN</span>
              <strong>No scores on the board yet</strong>
              <p>Play your first quiz and claim the top spot.</p>
              <button onClick={() => navigate('/quizzes')}>Play a quiz <GameControllerIcon weight="fill" /></button>
            </section>
          ) : (
            <>
              {players.length > 0 && (
                <section className="leaderboard-podium-section" aria-label="Top three players">
                  <div className="leaderboard-section-heading">
                    <div><span className="leaderboard-kicker">THE ELITE</span><h2>Hall of fame</h2></div>
                    <span><MedalIcon weight="fill" /> TOP 3 PLAYERS</span>
                  </div>
                  <div className="leaderboard-podium">
                    {renderPodiumPlayer(players[1], 2)}
                    {renderPodiumPlayer(players[0], 1)}
                    {renderPodiumPlayer(players[2], 3)}
                  </div>
                </section>
              )}

              <section className="leaderboard-table-section">
                <div className="leaderboard-section-heading leaderboard-section-heading--table">
                  <div><span className="leaderboard-kicker">KEEP CLIMBING</span><h2>Player rankings</h2></div>
                  <span className="leaderboard-player-count">{players.length} PLAYERS</span>
                </div>
                {players.length > 3 ? (
                  <div className="leaderboard-table">
                    <div className="leaderboard-table__header"><span>RANK</span><span>PLAYER</span><span>BEST TIME</span><span>{activeTab === 'global' ? 'SEASON PTS' : `${activeTab.toUpperCase()} PTS`}</span></div>
                    {players.slice(3).map((player, index) => {
                      const rank = index + 4
                      const isMe = player.id === profile?.id
                      return (
                        <button
                          key={player.id}
                          type="button"
                          onClick={() => navigate(`/player/${player.id}`)}
                          className={`leaderboard-row ${isMe ? 'is-you' : ''}`}
                        >
                          <span className="leaderboard-row__rank">{String(rank).padStart(2, '0')}</span>
                          <span className="leaderboard-row__player">
                            <PlayerAvatar
                              className="leaderboard-row__avatar"
                              avatarUrl={player.avatar_url}
                              borderUrl={player.border_url}
                              displayName={player.display_name}
                            />
                            <span className="leaderboard-row__identity">
                              <strong>{player.display_name}{isMe && <i>YOU</i>}</strong>
                              <span>{activeTab === 'global' ? `${player.age_category || 'PLAYER'} TIER` : `RANK #${rank}`}</span>
                            </span>
                            {renderPlayerBadge(player.points)}
                          </span>
                          <span className="leaderboard-row__time"><TimerIcon /> {formatTime(player.bestTime) || '?'}</span>
                          <span className="leaderboard-row__points"><LightningIcon weight="fill" /> {player.points.toLocaleString()}</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="leaderboard-short-list">You?re looking at the top three. Keep playing to see more rivals here.</div>
                )}
              </section>

              {currentUserRank > 3 && profile?.role === 'player' && (
                <div className="leaderboard-you-bar">
                  <span className="leaderboard-you-bar__rank">#{String(currentUserRank).padStart(2, '0')}</span>
                  <PlayerAvatar
                    className="leaderboard-you-bar__avatar"
                    avatarUrl={profile?.avatar_url}
                    borderUrl={players[currentUserRank - 1]?.border_url}
                    displayName={profile?.display_name}
                  />
                  <span className="leaderboard-you-bar__name">{profile?.display_name} <i>YOU</i></span>
                  {renderPlayerBadge(currentUserPoints)}
                  <span className="leaderboard-you-bar__points"><LightningIcon weight="fill" /> {currentUserPoints.toLocaleString()} <small>PTS</small></span>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <nav className="leaderboard-mobile-nav" aria-label="Mobile navigation">
        <button onClick={() => navigate('/dashboard')}><HouseIcon weight="fill" /><span>Home</span></button>
        <button onClick={() => navigate('/quizzes')}><GameControllerIcon weight="fill" /><span>Play</span></button>
        <button className="is-active" aria-current="page"><TrophyIcon weight="fill" /><span>Ranks</span></button>
        <button onClick={() => navigate('/clans')}><ShieldIcon weight="fill" /><span>Clans</span></button>
        <button onClick={() => navigate('/rewards')}><ShoppingBagIcon weight="fill" /><span>Shop</span></button>
        <button onClick={() => navigate('/profile')}><UserIcon weight="fill" /><span>Profile</span></button>
      </nav>
    </div>
  )
}