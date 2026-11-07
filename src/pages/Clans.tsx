import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LoadingIndicator } from '../components/LoadingScreen'
import LoadingScreen from '../components/LoadingScreen'
import ModalPresence from '../components/ModalPresence'
import PlayerAvatar from '../components/PlayerAvatar'
import {
  ShieldIcon, UsersIcon, TrophyIcon, PlusIcon, XIcon,
  CameraIcon, PencilIcon, TrashIcon, CaretLeftIcon,
  ChatCircleDotsIcon, PaperPlaneRightIcon, CaretRightIcon,
  CheckCircleIcon, WarningCircleIcon, CrownIcon, SparkleIcon,
  SwordIcon, FlagIcon, LockIcon, ClockIcon,
  HouseIcon, GameControllerIcon, ShoppingBagIcon, UserIcon,
  SignOutIcon, CoinsIcon, LightningIcon, HourglassIcon, MedalIcon,
} from '@phosphor-icons/react'
import { useNotifications } from './notifications/NotificationsProvider'
import sabtaLogo from '../assets/icons/sabta-logo.png'
import '../css/Clans.css'
import '../css/UserDashboard.css'

export default function Clans() {
  const navigate = useNavigate()
  const { profile, setProfile } = useNotifications()
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [equippedBackground, setEquippedBackground] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [equippedBorder, setEquippedBorder] = useState<string | null>(null)
  const [seasonPoints, setSeasonPoints] = useState<number | null>(null)
  const [season, setSeason] = useState<{ name: string; daysLeft: number } | null>(null)
  const [level, setLevel] = useState(1)

  const [notification, setNotification] = useState<{ type: 'success' | 'error', msg: string } | null>(null)
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, type: 'delete' | 'leave' | null }>({ isOpen: false, type: null })

  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [clanAvatar, setClanAvatar] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const [myClan, setMyClan] = useState<any>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editTag, setEditTag] = useState('')
  const [editAvatar, setEditAvatar] = useState<File | null>(null)
  const editFileInputRef = useRef<HTMLInputElement>(null)

  const [isLeader, setIsLeader] = useState(false)

  const [viewingClan, setViewingClan] = useState<any | null>(null)
  const [viewingMembers, setViewingMembers] = useState<any[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  const [clanMembers, setClanMembers] = useState<any[]>([])

  const [isChatOpen, setIsChatOpen] = useState(false)
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [isWarRoomOpen, setIsWarRoomOpen] = useState(false)
  const [activeWars, setActiveWars] = useState<any[]>([])
  const [pendingChallenges, setPendingChallenges] = useState<any[]>([])
  const [selectedFighters, setSelectedFighters] = useState<string[]>([])
  const [joiningWar, setJoiningWar] = useState(false)
  const [myWar, setMyWar] = useState<any>(null)
  const [lockedFighters, setLockedFighters] = useState<string[]>([])

  const [teamSizeIntent, setTeamSizeIntent] = useState<number | null>(null)

  const requiredTeamSize: number =
    teamSizeIntent
    ?? myWar?.team_size
    ?? 5

  const isRosterLocked = !!myWar?.clan_b_id

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [notification])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

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

  // --- Load sidebar profile data (avatar, border, bg, season, level) ---
  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false

    const loadSidebarData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      const googleAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture
      setAvatarUrl(profile?.avatar_url || googleAvatar || null)

      const { data: invData } = await supabase
        .from('user_inventory')
        .select('*, cosmetic_items(*)')
        .eq('user_id', profile.id)
        .eq('is_equipped', true)

      if (invData && !cancelled) {
        const border = invData.find((i) => i.cosmetic_items?.cosmetic_type === 'avatar_border')
        if (border?.cosmetic_items?.preview_url) setEquippedBorder(border.cosmetic_items.preview_url)
        const bg = invData.find((i) => i.cosmetic_items?.cosmetic_type === 'background')
        if (bg?.cosmetic_items?.preview_url) setEquippedBackground(bg.cosmetic_items.preview_url)
      }

      const { data: leaderboardRows } = await supabase.rpc('get_season_leaderboard', { p_age_category: null })
      if (!cancelled && leaderboardRows) {
        const seasonRow = leaderboardRows.find((row: { id: string; points: number }) => row.id === profile.id)
        setSeasonPoints(seasonRow?.points ?? 0)
      }

      const { data: seasonData } = await supabase.rpc('get_current_season')
      if (!cancelled && seasonData?.has_season) {
        setSeason({ name: seasonData.name, daysLeft: seasonData.days_left })
      }

      setLevel(Math.floor((profile?.points ?? 0) / 100) + 1)
    }

    loadSidebarData()
    return () => { cancelled = true }
  }, [profile?.id, profile?.points, profile?.avatar_url])

  useEffect(() => {
    let cancelled = false
    const checkLeader = async () => {
      if (!profile?.clan_id || !profile?.id) {
        if (!cancelled) setIsLeader(false)
        return
      }
      const { data: clanRow } = await supabase
        .from('clans')
        .select('id, leader_id')
        .eq('id', profile.clan_id)
        .maybeSingle()

      if (!cancelled) {
        setIsLeader(!!clanRow && clanRow.leader_id === profile.id)
      }
    }
    checkLeader()
    return () => { cancelled = true }
  }, [profile?.clan_id, profile?.id])

  const fetchMyClanMembers = async () => {
    if (!profile?.clan_id) {
      setClanMembers([])
      return
    }
    const { data } = await supabase
      .from('profiles')
      .select(`
        id, display_name, avatar_url, points,
        user_inventory ( is_equipped, cosmetic_items ( cosmetic_type, preview_url ) )
      `)
      .eq('clan_id', profile.clan_id)
      .order('points', { ascending: false })

    if (data) setClanMembers(data)
  }

  useEffect(() => {
    if (profile) fetchClans()
  }, [profile])

  useEffect(() => {
    if (profile?.clan_id) fetchMyClanMembers()
    else setClanMembers([])
  }, [profile?.clan_id])

  const fetchWarData = async () => {
    if (!profile?.clan_id) return

    const { data: warData } = await supabase
      .from('clan_wars')
      .select(`
        *,
        clan_a:clan_a_id (id, name, tag),
        clan_b:clan_b_id (id, name, tag)
      `)
      .eq('status', 'active')
      .or(`clan_a_id.eq.${profile.clan_id},clan_b_id.eq.${profile.clan_id}`)
      .maybeSingle()

    if (warData) {
      setMyWar(warData)
      setActiveWars([])
      setPendingChallenges([])

      const { data: lockedData } = await supabase
        .from('clan_war_fighters')
        .select('user_id')
        .eq('war_id', warData.id)
        .eq('clan_id', profile.clan_id)

      if (lockedData) {
        const lockedIds = lockedData.map((f: any) => f.user_id)
        setLockedFighters(lockedIds)

        if (!warData.clan_b_id) {
          setSelectedFighters(lockedIds)
        }
      }

      return
    }

    setMyWar(null)
    setLockedFighters([])

    const { data: openWars } = await supabase
      .from('clan_wars')
      .select(`*, clan_a:clan_a_id (id, name, tag)`)
      .eq('status', 'active')
      .is('clan_b_id', null)

    const filteredWars = (openWars ?? []).filter(w => w.clan_a_id !== profile.clan_id)
    setActiveWars(filteredWars)

    const { data: challenges } = await supabase
      .from('clan_war_challenges')
      .select(`*, challenger_clan:challenger_clan_id (id, name, tag)`)
      .eq('opponent_clan_id', profile.clan_id)
      .eq('status', 'pending')

    if (challenges) setPendingChallenges(challenges)
  }

  useEffect(() => {
    if (!profile?.clan_id || !isWarRoomOpen) return

    const warChannel = supabase
      .channel(`clan-war-live-${profile.clan_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clan_wars' },
        (payload) => {
          const w = payload.new as any
          if (w.clan_a_id === profile.clan_id || w.clan_b_id === profile.clan_id) {
            fetchWarData()
          }
        }
      )
      .subscribe()

    const challengeChannel = supabase
      .channel(`clan-challenges-live-${profile.clan_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'clan_war_challenges',
          filter: `opponent_clan_id=eq.${profile.clan_id}`,
        },
        () => { fetchWarData() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(warChannel)
      supabase.removeChannel(challengeChannel)
    }
  }, [profile?.clan_id, isWarRoomOpen])

  const getEquippedBorder = (userData: any) => {
    if (!userData?.user_inventory) return null
    const equipped = userData.user_inventory.find((ui: any) => ui.is_equipped && ui.cosmetic_items?.cosmetic_type === 'avatar_border')
    return equipped?.cosmetic_items?.preview_url || null
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

  const handleViewClan = async (clan: any) => {
    setLoadingMembers(true)

    if (!clan.clan_id) {
      setViewingClan({ ...clan, clan_name: 'Open Arena', clan_tag: '???', leader_id: null })
      setViewingMembers([])
      setLoadingMembers(false)
      return
    }

    const { data: clanDetails } = await supabase
      .from('clans')
      .select('id, leader_id')
      .eq('id', clan.clan_id)
      .single()

    setViewingClan({ ...clan, leader_id: clanDetails?.leader_id })

    const { data } = await supabase
      .from('profiles')
      .select(`
        id, display_name, avatar_url, points,
        user_inventory ( is_equipped, cosmetic_items ( cosmetic_type, preview_url ) )
      `)
      .eq('clan_id', clan.clan_id)
      .order('points', { ascending: false })

    if (data) setViewingMembers(data)
    setLoadingMembers(false)
  }

  const getFilePathFromUrl = (url: string) => {
    if (!url) return null
    const parts = url.split('/clan-avatars/')
    return parts.length > 1 ? parts[1] : null
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
    if (isLeader) {
      setConfirmModal({ isOpen: true, type: 'delete' })
    } else {
      setConfirmModal({ isOpen: true, type: 'leave' })
    }
  }

  const executeLeaveClan = async () => {
    setConfirmModal({ isOpen: false, type: null })

    if (isLeader) {
      const oldFilePath = getFilePathFromUrl(myClan?.clan_avatar)
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

  const openWarRoom = async () => {
    setIsWarRoomOpen(true)
    setSelectedFighters([])
    setTeamSizeIntent(null)
    await Promise.all([fetchMyClanMembers(), fetchWarData()])
  }

  const handleSelectWar = (teamSize: number) => {
    if (selectedFighters.length > teamSize) {
      setSelectedFighters(prev => prev.slice(0, teamSize))
    }
    setTeamSizeIntent(teamSize)
  }

  const toggleFighterSelection = (userId: string) => {
    if (isRosterLocked || !isLeader) return

    setSelectedFighters(prev => {
      if (prev.includes(userId)) return prev.filter(id => id !== userId)
      if (prev.length >= requiredTeamSize) {
        setNotification({ type: 'error', msg: `You can only select ${requiredTeamSize} fighters.` })
        return prev
      }
      return [...prev, userId]
    })
  }

  const validateOwnFighters = () => {
    if (selectedFighters.length !== requiredTeamSize) return false
    const ownIds = new Set(clanMembers.map(m => m.id))
    return selectedFighters.every(id => ownIds.has(id))
  }

  const handleUpdateRoster = async () => {
    if (!validateOwnFighters() || !myWar) return

    setJoiningWar(true)
    const { error } = await supabase.rpc('join_open_war', {
      p_war_id: myWar.id,
      p_fighter_ids: selectedFighters
    })

    setJoiningWar(false)

    if (error) {
      return setNotification({ type: 'error', msg: error.message })
    }

    setNotification({ type: 'success', msg: "Fighters updated!" })
    fetchWarData()
  }

  const handleJoinWar = async (warId: string, teamSize: number) => {
    handleSelectWar(teamSize)
    if (selectedFighters.length !== teamSize) {
      return setNotification({ type: 'error', msg: `Please select exactly ${teamSize} fighters from your clan.` })
    }

    setJoiningWar(true)
    const { error } = await supabase.rpc('join_open_war', {
      p_war_id: warId,
      p_fighter_ids: selectedFighters
    })

    setJoiningWar(false)

    if (error) {
      return setNotification({ type: 'error', msg: error.message })
    }

    setNotification({ type: 'success', msg: "Clan joined the war!" })
    setIsWarRoomOpen(false)
    setSelectedFighters([])
    setTeamSizeIntent(null)
    fetchWarData()
  }

  const handleAcceptChallenge = async (challengeId: string, teamSize: number) => {
    handleSelectWar(teamSize)
    if (selectedFighters.length !== teamSize) {
      return setNotification({ type: 'error', msg: `Please select exactly ${teamSize} fighters from your clan.` })
    }

    setJoiningWar(true)
    const { error } = await supabase.rpc('accept_clan_challenge', {
      p_challenge_id: challengeId,
      p_fighter_ids: selectedFighters
    })
    setJoiningWar(false)

    if (error) return setNotification({ type: 'error', msg: error.message })

    setNotification({ type: 'success', msg: "Challenge accepted!" })
    setIsWarRoomOpen(false)
    setSelectedFighters([])
    setTeamSizeIntent(null)
    fetchWarData()
  }

  const handleDeclineChallenge = async (challengeId: string) => {
    const { error } = await supabase.rpc('decline_clan_challenge', { p_challenge_id: challengeId })
    if (error) return setNotification({ type: 'error', msg: error.message })
    setNotification({ type: 'success', msg: "Challenge declined." })
    fetchWarData()
  }

  const myClanRank = leaderboard.findIndex((clan) => clan.clan_id === profile?.clan_id)

  if (loading) {
    return <LoadingScreen title="Gathering your clan" subtitle="Loading clan members and standings." />
  }

  return (
    <div className="game-dashboard">
      <div className="game-dashboard__ambient" aria-hidden="true" />
      {equippedBackground && (
        <div className="game-dashboard__cosmetic-bg" aria-hidden="true">
          <img src={equippedBackground} alt="" />
        </div>
      )}

      {/* ============ SIDEBAR ============ */}
      <aside className="game-sidebar">
        <button className="game-brand" onClick={() => navigate('/dashboard')} aria-label="SabTa home">
          <span className="game-brand__mark"><img src={sabtaLogo} alt="" /></span>
          <span className="game-brand__word">SAB<span>TA</span><small>PLAYER ARENA</small></span>
        </button>

        <div className="game-sidebar__section-label">MENU</div>
        <nav className="game-nav" aria-label="Main navigation">
          <button className="game-nav__item" onClick={() => navigate('/dashboard')}>
            <HouseIcon weight="fill" /><span>Overview</span><CaretRightIcon className="game-nav__arrow" />
          </button>
          <button className="game-nav__item" onClick={() => navigate('/quizzes')}>
            <GameControllerIcon weight="fill" /><span>Play quiz</span><CaretRightIcon className="game-nav__arrow" />
          </button>
          <button className="game-nav__item" onClick={() => navigate('/leaderboard')}>
            <TrophyIcon weight="fill" /><span>Leaderboard</span><CaretRightIcon className="game-nav__arrow" />
          </button>
          <button className="game-nav__item is-active" aria-current="page">
            <ShieldIcon weight="fill" /><span>Clans</span><i />
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
              <span>LEVEL {level} • {profile?.age_category?.toUpperCase() || 'ROOKIE'}</span>
            </div>
            <button className="game-logout" onClick={handleLogout} aria-label="Log out" title="Log out">
              <SignOutIcon weight="bold" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============ MAIN CONTENT ============ */}
      <main className="game-main">
        <header className="game-topbar">
          <button className="game-brand game-brand--mobile" onClick={() => navigate('/dashboard')} aria-label="SabTa home">
            <span className="game-brand__mark"><img src={sabtaLogo} alt="" /></span>
            <span className="game-brand__word">SAB<span>TA</span></span>
          </button>
          <div className="game-topbar__crumb"><span>PLAYER HUB</span><i>/</i> CLANS</div>
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
            <button className="game-topbar__logout" onClick={handleLogout} aria-label="Log out" title="Log out">
              <SignOutIcon weight="bold" />
            </button>
          </div>
        </header>

        <div className="game-content">
          {/* Notifications */}
          {notification && (
            <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl font-bold text-sm shadow-2xl border flex items-center gap-2 animate-in slide-in-from-top-4 ${
              notification.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              {notification.type === 'success' ? <CheckCircleIcon weight="fill" /> : <WarningCircleIcon weight="fill" />}
              {notification.msg}
            </div>
          )}

          {/* Hero header */}
          <header className="clans-hero">
            <div className="clans-hero__topline">
              <button onClick={() => navigate('/dashboard')} className="clans-back" aria-label="Back to dashboard">
                <CaretLeftIcon weight="bold" size={20} />
              </button>
              <span>PLAYER HUB <i>/</i> CLAN ARENA</span>
            </div>
            <div className="clans-hero__body">
              <div>
                <span className="clans-eyebrow"><ShieldIcon weight="fill" /> THE TEAM FRONT</span>
                <h1>Stronger <span>together.</span></h1>
                <p>Find your squad, build your legacy, and climb the clan rankings as a team.</p>
              </div>
              <div className="clans-hero__stats">
                <div><UsersIcon weight="fill" /><strong>{leaderboard.length}</strong><small>CLANS RANKED</small></div>
                <span />
                <div><TrophyIcon weight="fill" /><strong>{myClanRank >= 0 ? `#${myClanRank + 1}` : '--'}</strong><small>YOUR POSITION</small></div>
              </div>
            </div>
            <div className="clans-hero__bottom">
              <span><i /> {profile?.clan_id ? 'CLAN MEMBER' : 'FREE AGENT'}</span>
              <span>PLAY QUIZZES. EARN POINTS. RISE TOGETHER.</span>
            </div>
            <span className="clans-hero__deco" aria-hidden="true"><ShieldIcon weight="duotone" /></span>
          </header>

          {profile?.clan_id ? (
            <section className="clans-current-panel bg-[#0f1014]/90 backdrop-blur-md border border-white/10 p-6 rounded-3xl mb-8 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-xl shadow-black/50">
              <div className="clans-current-panel__identity flex items-center gap-4">
                <div className="clans-emblem w-16 h-16 bg-black/50 border border-white/10 rounded-2xl flex items-center justify-center font-bold text-xl text-[#ccff00] overflow-hidden shrink-0 shadow-lg">
                  {myClan?.clan_avatar ? (
                    <img src={myClan.clan_avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span>{myClan?.clan_tag || 'CLAN'}</span>
                  )}
                </div>
                <div>
                  <span className="clans-current-panel__tag text-gray-400">
                    [{myClan?.clan_tag || 'SQUAD'}] {isLeader ? '· CLAN LEADER' : '· YOUR CLAN'}
                  </span>
                  <h2 className="text-2xl font-black text-white tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] my-0.5">
                    {myClan?.clan_name || 'Your Clan'}
                  </h2>
                  <p className="text-gray-300 text-sm font-medium">Play quizzes to increase your clan's total points.</p>
                  {myClan && (
                    <span className="clans-current-panel__points mt-1 inline-flex items-center gap-1.5 text-[#ccff00] font-bold text-sm bg-[#ccff00]/10 px-2 py-1 rounded-md">
                      <TrophyIcon weight="fill" /> {(myClan.total_points || 0).toLocaleString()} TOTAL POINTS
                    </span>
                  )}
                </div>
              </div>

              <div className="clans-current-panel__actions flex flex-wrap items-center gap-2">
                <button onClick={() => setIsChatOpen(true)} className="bg-[#00f0ff] text-black px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white transition flex items-center gap-2 shadow-lg">
                  <ChatCircleDotsIcon weight="bold" size={18} /> Chat
                </button>
                <button onClick={openWarRoom} className="bg-purple-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white hover:text-black transition flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.4)]">
                  <SwordIcon weight="fill" size={18} /> War Room
                </button>
                <button onClick={() => navigate('/war-log')} className="bg-white/10 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white/20 transition flex items-center gap-2">
                  <TrophyIcon weight="fill" size={18} /> War Log
                </button>
                
                {isLeader && (
                  <button 
                    onClick={() => { setIsEditing(true); setEditName(myClan.clan_name); setEditTag(myClan.clan_tag); }} 
                    className="bg-white/5 border border-white/20 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-white/10 transition flex items-center gap-2"
                  >
                    <PencilIcon weight="bold" size={18} /> Edit
                  </button>
                )}

                <button onClick={handleLeaveClan} className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-red-500/20 transition flex items-center gap-2">
                  <TrashIcon weight="bold" size={18} /> {isLeader ? 'Delete' : 'Leave'}
                </button>
              </div>
            </section>
          ) : (
            <div className="clans-onboarding grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="clans-create-card bg-[#0f1014]/90 backdrop-blur-md border border-white/10 p-6 rounded-3xl shadow-xl shadow-black/50">
                <div className="clans-card-heading">
                  <span className="clans-card-heading__icon"><PlusIcon weight="bold" /></span>
                  <div><h2>Create a Clan</h2><p>Start your own team and set the standard.</p></div>
                </div>
                <form onSubmit={handleCreateClan} className="space-y-4">
                  <div className="flex justify-center mb-4">
                    <button type="button" aria-label="Choose clan image" onClick={() => fileInputRef.current?.click()} className="clans-upload w-24 h-24 rounded-2xl bg-black/50 border-2 border-dashed border-white/20 hover:border-[#ccff00] flex flex-col items-center justify-center cursor-pointer overflow-hidden transition relative group">
                      {clanAvatar ? (
                        <img src={URL.createObjectURL(clanAvatar)} alt="Clan" className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <CameraIcon size={24} className="text-gray-400 group-hover:text-[#ccff00] mb-1" />
                          <span className="text-[10px] text-gray-500 font-bold">Add Photo</span>
                        </>
                      )}
                    </button>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={(e) => setClanAvatar(e.target.files?.[0] || null)} className="hidden" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-bold block mb-1">Clan Name</label>
                    <input required value={name} onChange={e => setName(e.target.value)} maxLength={20} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#ccff00]" placeholder="e.g. Trivia Masters" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 font-bold block mb-1">Clan Tag (Max 4 chars)</label>
                    <input required value={tag} onChange={e => setTag(e.target.value)} maxLength={4} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white uppercase outline-none focus:border-[#ccff00]" placeholder="e.g. TRIV" />
                  </div>
                  <button disabled={uploading} className="w-full bg-[#ccff00] !text-black font-black tracking-wide py-3 rounded-xl hover:bg-[#b3e600] hover:!text-black transition disabled:opacity-50 shadow-lg">
                    {uploading ? 'Creating...' : 'Create & Join'}
                  </button>
                </form>
              </div>

              <div className="clans-recruit-card bg-[#0f1014]/90 backdrop-blur-md border border-white/10 p-6 rounded-3xl flex flex-col justify-center items-center text-center shadow-xl shadow-black/50">
                <span className="clans-recruit-card__icon"><TrophyIcon weight="duotone" /></span>
                <span className="clans-eyebrow"><SparkleIcon weight="fill" /> FIND YOUR SQUAD</span>
                <h3>Join an existing clan</h3>
                <p>Explore the top-ranked teams below and join their push for the summit.</p>
                <span className="clans-recruit-card__count">{leaderboard.length} TEAMS IN THE ARENA</span>
              </div>
            </div>
          )}

          <section className="clans-leaderboard bg-[#0f1014]/90 backdrop-blur-md border border-white/10 rounded-3xl overflow-hidden shadow-xl shadow-black/50">
            <div className="clans-leaderboard__header p-5 border-b border-white/10 bg-black/40">
              <div><span className="clans-eyebrow"><TrophyIcon weight="fill" /> CLAN RANKINGS</span><h2>Top clans</h2><p>Teams leading the arena by total points.</p></div>
              <span className="clans-leaderboard__season">ALL-TIME STANDINGS</span>
            </div>
            <div className="clans-leaderboard__rows divide-y divide-white/5">
              {leaderboard.map((clan, idx) => (
                <div key={clan.clan_id} className={`clans-rank-row ${clan.clan_id === profile?.clan_id ? 'is-mine' : ''}`}>
                  <button type="button" className="clans-rank-row__details" onClick={() => handleViewClan(clan)} aria-label={`View ${clan.clan_name} members`}>
                    <span className={`clans-rank-row__rank ${idx < 3 ? `is-top-${idx + 1}` : ''}`}>
                      {idx === 0 && <CrownIcon weight="fill" />}
                      <small>#{idx + 1}</small>
                    </span>
                    <div className="clans-emblem clans-rank-row__emblem w-12 h-12 bg-black/50 border border-white/10 rounded-xl flex items-center justify-center font-bold text-sm text-[#ccff00] overflow-hidden shrink-0">
                      {clan.clan_avatar ? <img src={clan.clan_avatar} alt="" className="w-full h-full object-cover" /> : clan.clan_tag}
                    </div>
                    <div className="clans-rank-row__name">
                      <p>{clan.clan_name} {clan.clan_id === profile?.clan_id && <small>YOUR CLAN</small>}</p>
                      <span><b>[{clan.clan_tag}]</b><i /> <UsersIcon weight="fill" /> {clan.member_count} members</span>
                    </div>
                  </button>

                  <div className="clans-rank-row__right">
                    <div className="clans-rank-row__points">
                      <strong>{(clan.total_points || 0).toLocaleString()}</strong>
                      <span>POINTS</span>
                    </div>
                    {!profile?.clan_id && (
                      <button onClick={() => handleJoinClan(clan.clan_id)} className="clans-join-button">
                        Join <CaretRightIcon weight="bold" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && <div className="clans-rank-empty">No clans are listed yet. Be the first to create one.</div>}
            </div>
          </section>
        </div>
      </main>

      {/* ============ BOTTOM MOBILE NAV ============ */}
      <nav className="game-mobile-nav" aria-label="Mobile navigation">
        <button onClick={() => navigate('/dashboard')}><HouseIcon weight="fill" /><span>Home</span></button>
        <button onClick={() => navigate('/quizzes')}><GameControllerIcon weight="fill" /><span>Play</span></button>
        <button onClick={() => navigate('/leaderboard')}><TrophyIcon weight="fill" /><span>Ranks</span></button>
        <button className="is-active" aria-current="page"><ShieldIcon weight="fill" /><span>Clans</span></button>
        <button onClick={() => navigate('/rewards')}><ShoppingBagIcon weight="fill" /><span>Shop</span></button>
        <button onClick={() => navigate('/profile')}><UserIcon weight="fill" /><span>Profile</span></button>
      </nav>

      {/* ============ ALL MODALS ============ */}

      {/* WAR ROOM MODAL */}
      <ModalPresence
        open={isWarRoomOpen && !!myClan}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        panelClassName="w-full max-w-2xl"
      >
        {isWarRoomOpen && myClan && (
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl w-full h-[85vh] flex flex-col shadow-2xl relative overflow-hidden">
            <div className="p-5 border-b border-white/10 bg-black/40 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2"><SwordIcon weight="fill" className="text-purple-400" /> War Room</h2>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {isRosterLocked ? 'War is active. Roster is locked.' : `Select ${requiredTeamSize} fighters and find a match.`}
                </p>
              </div>
              <button onClick={() => { setIsWarRoomOpen(false); setSelectedFighters([]); setTeamSizeIntent(null); }} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-gray-400 hover:text-white">
                <XIcon weight="bold" size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto admin-custom-scrollbar flex flex-col md:flex-row">
              {/* Left: Fighter Selection */}
              <div className="w-full md:w-1/2 p-4 border-b md:border-b-0 md:border-r border-white/10 bg-[#050505]/50 flex flex-col">
                <div className="mb-3 flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      Select {requiredTeamSize} Fighter{requiredTeamSize === 1 ? '' : 's'}
                      {isRosterLocked && <LockIcon weight="bold" className="text-red-400" />}
                    </h3>
                    <p className="text-[10px] text-gray-400">Only these members will fight and earn rewards.</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-2 admin-custom-scrollbar">
                  {clanMembers.length === 0 ? (
                    <div className="text-center py-8 text-gray-500 text-xs">No members in your clan yet.</div>
                  ) : (
                    clanMembers.map(member => {
                      const isSelected = selectedFighters.includes(member.id)
                      const memberBorder = member.user_inventory?.find((i: any) => i.is_equipped && i.cosmetic_items?.cosmetic_type === 'avatar_border')
                      const isMemberLeader = myClan.leader_id === member.id

                      return (
                        <div
                          key={member.id}
                          onClick={() => toggleFighterSelection(member.id)}
                          className={`flex items-center justify-between p-2 rounded-xl border transition ${
                            isRosterLocked ? 'opacity-60 cursor-not-allowed border-transparent bg-black/20' : 'cursor-pointer'
                          } ${
                            isSelected ? 'bg-purple-500/20 border-purple-500/50' : 'bg-black/40 border-white/5 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
                              <div className="absolute inset-[15%] rounded-full bg-white/10 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-400 z-10">
                                {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : member.display_name?.charAt(0)}
                              </div>
                              {memberBorder?.cosmetic_items?.preview_url && (
                                <img src={memberBorder.cosmetic_items.preview_url} className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-white flex items-center gap-1">
                                {member.display_name}
                                {isMemberLeader && <CrownIcon weight="fill" size={12} className="text-[#ffd700]" />}
                              </span>
                            </div>
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-500'
                          }`}>
                            {isSelected && <CheckCircleIcon weight="bold" className="text-white w-4 h-4" />}
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
                <div className="pt-3 mt-auto border-t border-white/10">
                  <p className="text-xs text-center text-gray-400 font-bold">
                    {isRosterLocked ? 'Roster Locked' : `${selectedFighters.length} / ${requiredTeamSize} Selected`}
                  </p>
                </div>
              </div>

              {/* Right: Arenas & Challenges */}
              <div className="w-full md:w-1/2 p-4 flex flex-col">
                {myWar ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <ShieldIcon weight="duotone" className="w-16 h-16 text-[#ccff00] mb-4" />
                    <h3 className="text-lg font-black text-white mb-2">
                      {isRosterLocked ? 'War in Progress' : 'Waiting for Opponent'}
                    </h3>
                    <p className="text-xs text-gray-400 mb-4">
                      {isRosterLocked
                        ? 'Your clan is currently fighting in an active war.'
                        : 'Your clan has claimed this arena. We are waiting for another clan to join before the battle begins.'}
                    </p>
                    <div className="bg-black/40 rounded-xl p-4 w-full border border-white/10">
                      <p className="text-sm font-bold text-white mb-1">
                        {myWar.clan_a?.name || 'Clan A'} vs {myWar.clan_b?.name || 'Waiting...'}
                      </p>
                      {isRosterLocked ? (
                        <button
                          onClick={() => { setIsWarRoomOpen(false); navigate(`/war/${myWar.id}`); }}
                          className="mt-3 w-full bg-[#ccff00] !text-black font-black tracking-wide py-2 rounded-lg text-xs hover:bg-[#b3e600] hover:!text-black transition"
                        >
                          Enter War Arena
                        </button>
                      ) : (
                        <>
                          <div className="mt-3 w-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-2 cursor-not-allowed mb-3">
                            <ClockIcon weight="bold" /> Waiting for Challenger...
                          </div>
                          <button
                            onClick={handleUpdateRoster}
                            disabled={!isLeader || joiningWar || selectedFighters.length !== requiredTeamSize}
                            className="w-full bg-white !text-black font-black tracking-wide py-2 rounded-lg text-xs hover:bg-gray-300 hover:!text-black transition disabled:opacity-50"
                          >
                            {joiningWar ? 'Updating...' : 'Update Fighters'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col space-y-4">
                    {/* Warning for non-leaders */}
                    {!isLeader && (
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-yellow-400 font-bold">
                          👑 Only the Clan Leader can actually join or accept challenges.
                        </p>
                      </div>
                    )}

                    {pendingChallenges.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <FlagIcon weight="fill" /> Pending Challenges
                        </h3>
                        <div className="space-y-2">
                          {pendingChallenges.map(ch => {
                            const chSize = ch.team_size ?? 5
                            const matchesIntent = teamSizeIntent === null || teamSizeIntent === chSize
                            return (
                              <div key={ch.id} className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                  <p className="text-xs font-bold text-white">{ch.challenger_clan?.name}</p>
                                  <p className="text-[10px] text-gray-400">
                                    wants to fight! · <span className="text-[#ccff00] font-bold">{chSize}v{chSize}</span>
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleAcceptChallenge(ch.id, chSize)}
                                    disabled={!isLeader || joiningWar || (matchesIntent && selectedFighters.length !== chSize)}
                                    className="bg-green-500 !text-black px-2 py-1 rounded text-[10px] font-bold hover:bg-green-400 hover:!text-black disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Accept
                                  </button>
                                  <button onClick={() => handleDeclineChallenge(ch.id)} className="bg-white/10 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-white/20">
                                    Decline
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <h3 className="text-xs font-bold text-[#ccff00] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <SwordIcon weight="fill" /> Open Arenas
                      </h3>
                      {activeWars.length === 0 ? (
                        <div className="text-center py-6 bg-black/30 rounded-xl border border-white/5">
                          <p className="text-xs text-gray-500">No open arenas right now.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {activeWars.map(war => {
                            const wSize = war.team_size ?? 5
                            const matchesIntent = teamSizeIntent === null || teamSizeIntent === wSize
                            return (
                              <div key={war.id} className="bg-black/40 border border-white/10 rounded-xl p-3 flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">Clan A</p>
                                    <p className="text-xs font-bold text-white">{war.clan_a?.name || 'Open Arena'}</p>
                                    <p className="text-[10px] text-[#ccff00] font-bold mt-0.5">{wSize}v{wSize}</p>
                                  </div>
                                  {war.clan_a?.name && (
                                    <button
                                      onClick={() => handleViewClan({ clan_id: war.clan_a_id, clan_name: war.clan_a?.name, clan_tag: war.clan_a?.tag })}
                                      className="text-[10px] text-[#00f0ff] hover:underline"
                                    >
                                      View Profile
                                    </button>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleJoinWar(war.id, wSize)}
                                  disabled={!isLeader || joiningWar || (matchesIntent && selectedFighters.length !== wSize)}
                                  className="w-full bg-[#ccff00] !text-black font-black tracking-wide py-2 rounded-lg text-xs hover:bg-[#b3e600] hover:!text-black transition disabled:opacity-50 disabled:cursor-not-allowed drop-shadow-sm"
                                >
                                  {joiningWar ? 'Joining...' : `Join ${wSize}v${wSize} Arena`}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </ModalPresence>

      {/* CHAT MODAL */}
      <ModalPresence
        open={isChatOpen && !!myClan}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        panelClassName="w-full max-w-lg"
      >
        {isChatOpen && myClan && (
          <div className="clans-modal clans-chat-modal bg-[#0f1014] border border-white/10 rounded-3xl w-full h-[80vh] flex flex-col shadow-2xl relative">
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
                          if (!isMe) { setIsChatOpen(false); navigate('/player/' + msg.user_id) }
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
                        {borderUrl && <img src={borderUrl} alt="border" className="absolute inset-0 w-full h-full object-contain pointer-events-none z-20" />}
                      </div>
                      <div>
                        {!isMe && (
                          <p
                            onClick={() => { setIsChatOpen(false); navigate('/player/' + msg.user_id) }}
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
                <button type="submit" disabled={!newMessage.trim()} className="absolute right-2 p-2 bg-[#ccff00] text-black rounded-lg hover:bg-white transition disabled:opacity-50 disabled:hover:bg-[#ccff00]">
                  <PaperPlaneRightIcon weight="fill" size={16} />
                </button>
              </div>
            </form>
          </div>
        )}
      </ModalPresence>

      {/* EDIT MODAL */}
      <ModalPresence
        open={isEditing}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        panelClassName="w-full max-w-md"
      >
        {isEditing && (
          <div className="clans-modal clans-edit-modal bg-[#0f1014] border border-white/10 rounded-3xl w-full overflow-hidden shadow-2xl relative">
            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-black/40">
              <h2 className="text-xl font-black text-white">Edit Clan</h2>
              <button onClick={handleCancelEdit} className="text-gray-400 hover:text-white"><XIcon weight="bold" size={20} /></button>
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
                <input required value={editName} onChange={e => setEditName(e.target.value)} maxLength={20} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white outline-none focus:border-[#ccff00]" />
              </div>
              <div>
                <label className="text-xs font-bold block mb-1">Clan Tag</label>
                <input required value={editTag} onChange={e => setEditTag(e.target.value)} maxLength={4} className="w-full bg-black/50 border border-white/10 p-3 rounded-xl text-white uppercase outline-none focus:border-[#ccff00]" />
              </div>
              <button disabled={uploading} className="w-full bg-[#ccff00] !text-black font-black tracking-wide py-3 rounded-xl hover:bg-[#b3e600] hover:!text-black transition disabled:opacity-50 mt-2 shadow-lg">
                {uploading ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        )}
      </ModalPresence>

      {/* VIEW CLAN MODAL */}
      <ModalPresence
        open={!!viewingClan}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        panelClassName="w-full max-w-md"
      >
        {viewingClan && (
          <div className="clans-modal bg-[#0f1014] border border-white/10 rounded-3xl w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-white/10 bg-black/40 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-black/50 border border-white/10 rounded-xl flex items-center justify-center font-bold text-[#ccff00] overflow-hidden shrink-0">
                  {viewingClan.clan_avatar ? <img src={viewingClan.clan_avatar} alt="" className="w-full h-full object-cover" /> : viewingClan.clan_tag}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black text-white">{viewingClan.clan_name}</h2>
                    {viewingClan.leader_id === profile.id && <CrownIcon weight="fill" className="text-[#ffd700]" size={16} />}
                  </div>
                  <p className="text-xs text-gray-400 font-mono">[{viewingClan.clan_tag}]</p>
                </div>
              </div>
              <button onClick={() => setViewingClan(null)} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition text-gray-400 hover:text-white self-start">
                <XIcon weight="bold" size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-2 admin-custom-scrollbar flex-1">
              {loadingMembers ? (
                <LoadingIndicator label="Loading members..." className="justify-center py-10 text-sm" />
              ) : viewingMembers.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No members found.</div>
              ) : (
                viewingMembers.map((member, i) => {
                  const memberBorder = member.user_inventory?.find(
                    (inv: any) => inv.is_equipped && inv.cosmetic_items?.cosmetic_type === 'avatar_border'
                  )
                  const isMemberLeader = viewingClan.leader_id === member.id
                  return (
                    <div
                      key={member.id}
                      onClick={() => { setViewingClan(null); navigate('/player/' + member.id) }}
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
                        <div className="flex flex-col">
                          <p className="font-bold text-sm text-white group-hover:text-[#ccff00] transition">{member.display_name}</p>
                          {isMemberLeader ? (
                            <span className="text-[9px] font-black text-[#ffd700] uppercase tracking-wider flex items-center gap-1 mt-0.5">
                              <CrownIcon weight="fill" size={10} /> Leader
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">Member</span>
                          )}
                        </div>
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

            <div className="p-4 border-t border-white/10 bg-black/20 text-center shrink-0">
              <p className="text-xs text-gray-400">Total Clan Points: <span className="font-bold text-[#ccff00]">{(viewingClan.total_points || 0).toLocaleString()}</span></p>
            </div>
          </div>
        )}
      </ModalPresence>

      {/* CONFIRM MODAL */}
      <ModalPresence
        open={confirmModal.isOpen}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        panelClassName="w-full max-w-sm"
      >
        {confirmModal.isOpen && (
          <div className="clans-modal bg-[#0f1014] border border-white/10 rounded-3xl w-full overflow-hidden shadow-2xl relative p-6 text-center">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              confirmModal.type === 'delete' ? 'bg-red-500/20 text-red-500' : 'bg-yellow-500/20 text-yellow-500'
            }`}>
              {confirmModal.type === 'delete' ? <TrashIcon weight="fill" className="w-8 h-8" /> : <WarningCircleIcon weight="fill" className="w-8 h-8" />}
            </div>
            <h2 className="text-xl font-black text-white mb-2">
              {confirmModal.type === 'delete' ? 'Delete Clan?' : 'Leave Clan?'}
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              {confirmModal.type === 'delete'
                ? 'You are the Leader. If you leave, the clan will be permanently DELETED for everyone. Are you sure?'
                : 'Are you sure you want to leave this clan? You will lose your access to the clan chat and your points will no longer count towards the clan total.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal({ isOpen: false, type: null })} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition text-sm">
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
        )}
      </ModalPresence>
    </div>
  )
}