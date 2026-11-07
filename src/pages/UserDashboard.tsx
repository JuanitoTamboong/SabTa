// src/pages/UserDashboard.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LoadingIndicator } from '../components/LoadingScreen'
import LoadingScreen from '../components/LoadingScreen'
import PlayerAvatar from '../components/PlayerAvatar'
import {
  TrophyIcon,
  LightningIcon,
  TargetIcon,
  SignOutIcon,
  HouseIcon,
  GameControllerIcon,
  ShoppingBagIcon,
  UserIcon,
  ClockIcon,
  CaretRightIcon,
  MedalIcon,
  FireIcon,
  CheckCircleIcon,
  CoinsIcon,
  SwordIcon,
  HourglassIcon,
  ShieldIcon,
} from '@phosphor-icons/react'
import { fetchAllBadges, getPlayerBadge, type BadgeInfo } from '../lib/badges'
import sabtaLogo from '../assets/icons/sabta-logo.png'
import sabtaMascot from '../assets/images/sabta-center.png'
import { useNotifications } from './notifications/NotificationsProvider'
import '../css/UserDashboard.css'

type SeasonInfo = {
  seasonNumber: number
  name: string
  daysLeft: number
  endDate: string | null
} | null

export default function UserDashboard() {
  const navigate = useNavigate()
  const { profile, setProfile, checkAndShowDailyChallenge } = useNotifications()

  const [loading, setLoading] = useState(true)
  const [season, setSeason] = useState<SeasonInfo>(null)
  const [seasonPoints, setSeasonPoints] = useState<number | null>(null)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [equippedBorder, setEquippedBorder] = useState<string | null>(null)
  const [equippedBackground, setEquippedBackground] = useState<string | null>(null)

  const [allBadges, setAllBadges] = useState<BadgeInfo[]>([])

  const [stats, setStats] = useState({
    totalQuizzes: 0,
    bestScore: 0,
    accuracy: 0,
    level: 1,
    quizzesToday: 0,
  })

  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [topPlayers, setTopPlayers] = useState<any[]>([])
  const [topPlayersLoading, setTopPlayersLoading] = useState(true)

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 18) return 'Good afternoon'
    return 'Good evening'
  }

  // 🔧 Load current season info from database
  useEffect(() => {
    let cancelled = false
    const loadSeason = async () => {
      const { data, error } = await supabase.rpc('get_current_season')
      if (cancelled || error || !data?.has_season) return

      setSeason({
        seasonNumber: data.season_number,
        name: data.name,
        daysLeft: data.days_left,
        endDate: data.end_date ?? null,
      })
    }
    loadSeason()
    const id = setInterval(loadSeason, 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Fetch Top Players
  useEffect(() => {
    if (!profile?.age_category) {
      setTopPlayersLoading(false)
      return
    }

    const fetchTopPlayers = async () => {
      setTopPlayersLoading(true)
      const { data: topProfiles } = await supabase.rpc(
        'get_top_players',
        {
          p_age_category: profile.age_category,
          p_limit: 3,
        }
      )

      if (topProfiles) {
        setTopPlayers(topProfiles)
      }
      setTopPlayersLoading(false)
    }

    fetchTopPlayers()
  }, [profile?.age_category])

  // Fetch Dashboard Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          navigate('/')
          return
        }

        const badgesData = await fetchAllBadges()
        setAllBadges(badgesData)

        const { data: freshProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()

        if (freshProfile) {
          setProfile(freshProfile)
        }

        const { data: leaderboardRows, error: leaderboardError } = await supabase.rpc(
          'get_season_leaderboard',
          { p_age_category: null }
        )
        if (leaderboardError) {
          console.error('Failed to load dashboard season points:', leaderboardError)
          setSeasonPoints(null)
        } else {
          const seasonRow = leaderboardRows?.find((row: { id: string; points: number }) => row.id === user.id)
          setSeasonPoints(seasonRow?.points ?? 0)
        }

        const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
        setAvatarUrl(freshProfile?.avatar_url || googleAvatar || null)

        const { data: invData } = await supabase
          .from('user_inventory')
          .select('*, cosmetic_items(*)')
          .eq('user_id', user.id)
          .eq('is_equipped', true)

        if (invData) {
          const border = invData.find((i) => i.cosmetic_items?.cosmetic_type === 'avatar_border')
          if (border?.cosmetic_items?.preview_url) setEquippedBorder(border.cosmetic_items.preview_url)

          const bg = invData.find((i) => i.cosmetic_items?.cosmetic_type === 'background')
          if (bg?.cosmetic_items?.preview_url) setEquippedBackground(bg.cosmetic_items.preview_url)
        }

        const { data: attempts } = await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        let quizzesToday = 0
        if (attempts) {
          const today = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }).split(',')[0]
          const totalCompletedToday = attempts.filter((a) => {
            if (a.status !== 'completed') return false
            const attemptDate = new Date(a.created_at).toLocaleString('en-US', { timeZone: 'Asia/Manila' }).split(',')[0]
            return attemptDate === today
          }).length

          quizzesToday = Math.min(totalCompletedToday, 3)
          setStats(prev => ({ ...prev, quizzesToday }))

          if (totalCompletedToday >= 3) {
            await checkAndShowDailyChallenge()
          }
        }

        if (attempts && attempts.length > 0) {
          const recentAttempts = attempts.slice(0, 3)
          const recentAttemptIds = recentAttempts.map(a => a.id)
          const quizIds = recentAttempts.map((a) => a.quiz_id)

          const { data: quizzes } = await supabase
            .from('quizzes')
            .select('id, category')
            .in('id', quizIds)

          const { data: transactions } = await supabase
            .from('point_transactions')
            .select('reference_id, amount')
            .in('reference_id', recentAttemptIds)
            .eq('transaction_type', 'coin_transaction')

          const attemptsWithData = recentAttempts.map((attempt) => {
            const coinTx = transactions?.find(t => t.reference_id === attempt.id)
            const quizData = quizzes?.find((q) => q.id === attempt.quiz_id)
            return {
              ...attempt,
              category_name: quizData?.category || 'Unknown Category',
              real_coins_earned: coinTx ? coinTx.amount : 0
            }
          })

          const totalQuizzes = attempts.length
          const bestScore = totalQuizzes > 0 ? Math.max(...attempts.map((a) => a.score)) : 0
          const totalCorrect = attempts.reduce((acc, curr) => acc + curr.correct_answers, 0)
          const totalQuestionsAttempted = attempts.reduce(
            (acc, curr) => acc + (curr.correct_answers + curr.incorrect_answers + curr.unanswered_questions), 0
          )
          const avgAccuracy = totalQuestionsAttempted > 0 ? (totalCorrect / totalQuestionsAttempted) * 100 : 0

          const currentPoints = freshProfile?.points ?? 0
          const level = Math.floor(currentPoints / 100) + 1

          setStats({
            totalQuizzes,
            bestScore,
            accuracy: Math.round(avgAccuracy),
            level,
            quizzesToday,
          })
          setRecentActivity(attemptsWithData)
        } else {
          setStats(prev => ({ ...prev, quizzesToday: 0 }))
        }

      } catch {
        // Silently catch errors
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (loading) {
    return <LoadingScreen title="Loading your dashboard" subtitle="Getting your stats and next challenge ready." />
  }

  const currentBadge = seasonPoints === null ? null : getPlayerBadge(seasonPoints, allBadges)

  return (
    <div className="game-dashboard">
      <div className="game-dashboard__ambient" aria-hidden="true" />
      {equippedBackground && (
        <div className="game-dashboard__cosmetic-bg" aria-hidden="true">
          <img src={equippedBackground} alt="" />
        </div>
      )}

      <aside className="game-sidebar">
        <button className="game-brand" onClick={() => navigate('/dashboard')} aria-label="SabTa home">
          <span className="game-brand__mark"><img src={sabtaLogo} alt="" /></span>
          <span className="game-brand__word">SAB<span>TA</span><small>PLAYER ARENA</small></span>
        </button>

        <div className="game-sidebar__section-label">MENU</div>
        <nav className="game-nav" aria-label="Main navigation">
          <button className="game-nav__item is-active" aria-current="page">
            <HouseIcon weight="fill" /><span>Overview</span><i />
          </button>
          <button className="game-nav__item" onClick={() => navigate('/quizzes')}>
            <GameControllerIcon weight="fill" /><span>Play quiz</span><CaretRightIcon className="game-nav__arrow" />
          </button>
          <button className="game-nav__item" onClick={() => navigate('/leaderboard')}>
            <TrophyIcon weight="fill" /><span>Leaderboard</span><CaretRightIcon className="game-nav__arrow" />
          </button>
          <button className="game-nav__item" onClick={() => navigate('/clans')}>
            <ShieldIcon weight="fill" /><span>Clans</span><CaretRightIcon className="game-nav__arrow" />
          </button>
          <button className="game-nav__item" onClick={() => navigate('/rewards')}>
            <ShoppingBagIcon weight="fill" /><span>Rewards shop</span><CaretRightIcon className="game-nav__arrow" />
          </button>
          <button className="game-nav__item" onClick={() => navigate('/profile')}>
            <UserIcon weight="fill" /><span>My profile</span><CaretRightIcon className="game-nav__arrow" />
          </button>
        </nav>

        <div className="game-season-card">
          <span className="game-season-card__icon"><HourglassIcon weight="fill" /></span>
          <div>
            <span className="game-season-card__label">CURRENT SEASON</span>
            <strong>{season?.name || 'The Arena'}</strong>
            <small>{season ? (season.daysLeft <= 0 ? 'Ends today' : `${season.daysLeft} days remaining`) : 'Your next victory awaits'}</small>
          </div>
        </div>

        <div className="game-sidebar__bottom">
          <div className="game-sidebar-player">
            <PlayerAvatar
              className="game-avatar--small"
              avatarUrl={avatarUrl}
              borderUrl={equippedBorder}
              displayName={profile?.display_name}
            />
            <div className="game-sidebar-player__info">
              <strong>{profile?.display_name || 'Player'}</strong>
              {/* ✅ FIXED: Replaced the weird '?' with a bullet point '•' */}
              <span>LEVEL {stats.level} • {profile?.age_category?.toUpperCase() || 'ROOKIE'}</span>
            </div>
            <button className="game-logout" onClick={handleLogout} aria-label="Log out" title="Log out">
              <SignOutIcon weight="bold" />
            </button>
          </div>
        </div>
      </aside>

      <main className="game-main">
        <header className="game-topbar">
          <button className="game-brand game-brand--mobile" onClick={() => navigate('/dashboard')} aria-label="SabTa home">
            <span className="game-brand__mark"><img src={sabtaLogo} alt="" /></span>
            <span className="game-brand__word">SAB<span>TA</span></span>
          </button>
          <div className="game-topbar__crumb"><span>PLAYER HUB</span><i>/</i> OVERVIEW</div>
          <div className="game-topbar__right">
            <div className="game-wallet game-wallet--coins"><CoinsIcon weight="fill" /><strong>{profile?.coins || 0}</strong><span>COINS</span></div>
            <div className="game-wallet game-wallet--points"><LightningIcon weight="fill" /><strong>{seasonPoints === null ? '—' : seasonPoints.toLocaleString()}</strong><span>SEASON PTS</span></div>
            <button className="game-avatar-button" onClick={() => navigate('/profile')} aria-label="Open profile">
              <PlayerAvatar
                className="game-avatar--top"
                avatarUrl={avatarUrl}
                borderUrl={equippedBorder}
                displayName={profile?.display_name}
              />
            </button>
            <button
              className="game-topbar__logout"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
            >
              <SignOutIcon weight="bold" />
            </button>
          </div>
        </header>

        <div className="game-content">
          <section className="game-hero">
            <div className="game-hero__grid" aria-hidden="true" />
            <div className="game-hero__content">
              <div className="game-kicker"><span className="game-live-dot" /> YOUR ARENA IS READY</div>
              <h1>{getGreeting()},<br /><span>{profile?.display_name?.split(' ')[0] || 'Player'}.</span></h1>
              <p>Every question is a chance to climb. Pick a quiz, build your streak, and make your next move count.</p>
              <div className="game-hero__actions">
                <button className="game-button game-button--primary" onClick={() => navigate('/quizzes')}>
                  <GameControllerIcon weight="fill" /> Choose your quiz <CaretRightIcon weight="bold" />
                </button>
                <button className="game-button game-button--quiet" onClick={() => navigate('/battles')}>
                  <SwordIcon weight="fill" /> Battle history
                </button>
              </div>
              <div className="game-hero__meta">
                <span><FireIcon weight="fill" /> {profile?.current_streak || 0} DAY STREAK</span>
                <b />
                <span>{profile?.age_category?.toUpperCase() || 'GENERAL'} TIER</span>
                {season && <><b /><span className={season.daysLeft <= 7 ? 'is-urgent' : ''}><HourglassIcon weight="fill" /> {season.daysLeft <= 0 ? 'FINAL DAY' : `${season.daysLeft}D LEFT`}</span></>}
              </div>
            </div>
            <div className="game-hero__art" aria-hidden="true">
              <div className="game-hero__orbit game-hero__orbit--one" />
              <div className="game-hero__orbit game-hero__orbit--two" />
              <img src={sabtaMascot} alt="" />
              <span className="game-hero__art-label">SABTA<br />ARENA</span>
            </div>
            {currentBadge && <div className="game-hero__badge"><img src={currentBadge.image_url} alt={currentBadge.name} /><span>{currentBadge.name}<small>YOUR RANK</small></span></div>}
          </section>

          <section className="game-stats" aria-label="Your game stats">
            <article className="game-stat-card game-stat-card--cyan">
              <div className="game-stat-card__top"><span>QUIZZES PLAYED</span><GameControllerIcon weight="fill" /></div>
              <strong>{stats.totalQuizzes.toLocaleString()}</strong>
              <small>Keep the momentum going</small>
            </article>
            <article className="game-stat-card game-stat-card--violet">
              <div className="game-stat-card__top"><span>PERSONAL BEST</span><TrophyIcon weight="fill" /></div>
              <strong>{stats.bestScore}<small>PTS</small></strong>
              <small>Your highest scoring run</small>
            </article>
            <article className="game-stat-card game-stat-card--lime">
              <div className="game-stat-card__top"><span>ACCURACY</span><TargetIcon weight="fill" /></div>
              <strong>{stats.accuracy}<small>%</small></strong>
              <small>Precision makes champions</small>
            </article>
            <button className="game-stat-card game-stat-card--pink game-stat-card--link" onClick={() => navigate('/battles')}>
              <div className="game-stat-card__top"><span>YOUR BATTLES</span><SwordIcon weight="fill" /></div>
              <strong>ENTER <CaretRightIcon weight="bold" /></strong>
              <small>Review your battle history</small>
            </button>
          </section>

          <div className="game-dashboard-grid">
            <div className="game-dashboard-main-column">
              <section className="game-panel game-challenge">
                <div className="game-section-heading">
                  <div><span className="game-overline">DAILY QUEST</span><h2>One more step to greatness</h2></div>
                  <span className="game-quest-chip"><TargetIcon weight="fill" /> REPEATABLE</span>
                </div>
                <div className="game-challenge__body">
                  <div className="game-challenge__emblem"><LightningIcon weight="fill" /></div>
                  <div className="game-challenge__details">
                    <strong>Complete 3 quizzes today</strong>
                    <span>Finish your daily run and collect bonus loot.</span>
                    <div className="game-progress"><div style={{ width: `${Math.min((stats.quizzesToday / 3) * 100, 100)}%` }} /></div>
                    <div className="game-challenge__progress"><span>{stats.quizzesToday} <i>/ 3 MATCHES</i></span><span>{Math.min(Math.round((stats.quizzesToday / 3) * 100), 100)}%</span></div>
                  </div>
                  <div className="game-rewards"><span>REWARDS</span><strong><LightningIcon weight="fill" /> +25 <i>PTS</i></strong><strong><CoinsIcon weight="fill" /> +50 <i>COINS</i></strong></div>
                  <button className="game-icon-button" onClick={() => navigate('/quizzes')} aria-label="Start a quiz"><CaretRightIcon weight="bold" /></button>
                </div>
              </section>

              <section className="game-panel game-activity">
                <div className="game-section-heading">
                  <div><span className="game-overline">YOUR RECENT RUNS</span><h2>Battle log</h2></div>
                  <ClockIcon className="game-heading-icon" />
                </div>
                {recentActivity.length === 0 ? (
                  <div className="game-empty-state"><span><GameControllerIcon weight="fill" /></span><strong>No runs logged yet</strong><p>Your next great score starts with one quiz.</p><button onClick={() => navigate('/quizzes')}>Play your first quiz <CaretRightIcon weight="bold" /></button></div>
                ) : (
                  <div className="game-run-list">
                    {recentActivity.map((attempt, index) => {
                      const totalQ = attempt.correct_answers + attempt.incorrect_answers + attempt.unanswered_questions
                      const acc = totalQ > 0 ? Math.round((attempt.correct_answers / totalQ) * 100) : 0
                      return (
                        <article key={attempt.id} className="game-run">
                          <span className={`game-run__index ${index === 0 ? 'is-current' : ''}`}>{String(index + 1).padStart(2, '0')}</span>
                          <span className="game-run__icon"><CheckCircleIcon weight="fill" /></span>
                          <div className="game-run__info"><strong>{attempt.category_name}</strong><span>{new Date(attempt.created_at).toLocaleDateString()} • {acc}% accuracy</span></div>
                          <div className="game-run__score"><strong>+{attempt.score}<small> PTS</small></strong><span><CoinsIcon weight="fill" /> +{attempt.real_coins_earned}</span></div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            </div>

            <aside className="game-dashboard-side-column">
              <section className="game-panel game-leaderboard">
                <div className="game-section-heading">
                  <div><span className="game-overline">THE RACE IS ON</span><h2>Top {profile?.age_category || 'players'}</h2></div>
                  <MedalIcon weight="fill" className="game-heading-icon game-heading-icon--lime" />
                </div>
                {topPlayersLoading ? (
                  <LoadingIndicator label="Loading top players..." className="game-leaderboard__loading" />
                ) : topPlayers.length === 0 ? (
                  <div className="game-leaderboard__empty">No players yet. Be the first to set the pace.</div>
                ) : (
                  <div className="game-leaderboard__list">
                    {topPlayers.map((player, index) => {
                      const topPlayerBadge = getPlayerBadge(player.points || 0, allBadges)
                      return (
                        <div key={player.id || index} className={`game-leaderboard-player ${index === 0 ? 'is-first' : ''}`}>
                          <span className="game-leaderboard-player__rank">{String(index + 1).padStart(2, '0')}</span>
                          <PlayerAvatar
                            className="game-avatar--leader"
                            avatarUrl={player.avatar_url}
                            borderUrl={player.border_url}
                            displayName={player.display_name}
                          />
                          <div className="game-leaderboard-player__name"><strong>{player.display_name}</strong>{topPlayerBadge && <img src={topPlayerBadge.image_url} alt={topPlayerBadge.name} title={topPlayerBadge.name} />}</div>
                          <span className="game-leaderboard-player__points">{player.points || 0}<small> PTS</small></span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <button className="game-leaderboard__button" onClick={() => navigate('/leaderboard')}>View full leaderboard <CaretRightIcon weight="bold" /></button>
              </section>

              <section className="game-level-card">
                <div className="game-level-card__header"><span>PLAYER LEVEL</span><span>LVL {stats.level}</span></div>
                <div className="game-level-card__number">{String(stats.level).padStart(2, '0')}<span> / NEXT LEVEL</span></div>
                <div className="game-progress game-progress--level"><div style={{ width: `${(profile?.points ?? 0) % 100}%` }} /></div>
                <div className="game-level-card__footer"><span>{(profile?.points ?? 0) % 100} / 100 XP</span><span>{profile?.points || 0} TOTAL PTS</span></div>
              </section>
            </aside>
          </div>
        </div>
      </main>

      <nav className="game-mobile-nav" aria-label="Mobile navigation">
        <button className="is-active" aria-current="page"><HouseIcon weight="fill" /><span>Home</span></button>
        <button onClick={() => navigate('/quizzes')}><GameControllerIcon weight="fill" /><span>Play</span></button>
        <button onClick={() => navigate('/leaderboard')}><TrophyIcon weight="fill" /><span>Ranks</span></button>
        <button onClick={() => navigate('/clans')}><ShieldIcon weight="fill" /><span>Clans</span></button>
        <button onClick={() => navigate('/rewards')}><ShoppingBagIcon weight="fill" /><span>Shop</span></button>
        <button onClick={() => navigate('/profile')}><UserIcon weight="fill" /><span>Profile</span></button>
      </nav>
    </div>
  )
}