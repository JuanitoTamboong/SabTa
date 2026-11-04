// src/pages/RewardsShop.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoadingScreen from '../components/LoadingScreen'
import ModalPresence from '../components/ModalPresence'
import {
  CoinsIcon, SignOutIcon, HouseIcon, GameControllerIcon, TrophyIcon,
  ShoppingBagIcon, UserIcon, CheckCircleIcon, StarIcon, PaletteIcon,
  ImageIcon, XCircleIcon, XIcon, EyeIcon, ShieldIcon, CaretRightIcon,
  SparkleIcon, MagnifyingGlassIcon
} from '@phosphor-icons/react'
import sabtaLogo from '../assets/icons/sabta-logo.png'
import '../css/RewardsShop.css'

export default function RewardsShop() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [inventory, setInventory] = useState<string[]>([])
  const [items, setItems] = useState<any[]>([])
  const [equippedBackground, setEquippedBackground] = useState<string | null>(null)

  // Modals State
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [purchaseItem, setPurchaseItem] = useState<any>(null)
  
  const [purchasing, setPurchasing] = useState(false)
  const [activeTab, setActiveTab] = useState('all')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')

      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (profileData) setProfile(profileData)

      const { data: inventoryData } = await supabase
        .from('user_inventory')
        .select('cosmetic_item_id, is_equipped, cosmetic_items(cosmetic_type, preview_url)')
        .eq('user_id', user.id)
      
      if (inventoryData) {
        setInventory(inventoryData.map(i => i.cosmetic_item_id))
        
        const bg = inventoryData.find(i => 
          i.is_equipped && 
          (i.cosmetic_items as any)?.cosmetic_type === 'background'
        )
        if (bg && (bg.cosmetic_items as any)?.preview_url) {
          setEquippedBackground((bg.cosmetic_items as any).preview_url)
        }
      }

      const { data: itemsData } = await supabase.from('cosmetic_items').select('*').eq('status', 'published').order('price', { ascending: true })
      if (itemsData) setItems(itemsData)

      setLoading(false)
    }

    fetchData()
  }, [navigate])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const handlePurchase = async () => {
    if (!purchaseItem || purchasing) return
    
    if ((profile?.coins || 0) < purchaseItem.price) {
      setToast({ type: 'error', msg: "You don't have enough coins for this item!" })
      return
    }

    setPurchasing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data: updatedProfile, error: profileError } = await supabase
        .from('profiles')
        .update({ coins: (profile?.coins || 0) - purchaseItem.price })
        .eq('id', user.id)
        .select('coins')
        .single()

      if (profileError) throw profileError

      const { error: inventoryError } = await supabase
        .from('user_inventory')
        .insert({ user_id: user.id, cosmetic_item_id: purchaseItem.id, is_equipped: false })

      if (inventoryError) throw inventoryError

      setProfile((prev: any) => ({ ...prev, coins: updatedProfile.coins }))
      setInventory((prev) => [...prev, purchaseItem.id])
      setPurchaseItem(null)
      setSelectedItem(null) 
      setToast({ type: 'success', msg: "Item purchased successfully!" })

    } catch (err: any) {
      console.error("Purchase failed:", err)
      setToast({ type: 'error', msg: "Failed to complete purchase. Please try again." })
    } finally {
      setPurchasing(false)
    }
  }

  const rarityOrder: Record<string, number> = {
    legendary: 1,
    epic: 2,
    rare: 3,
    common: 4
  }

  const filteredItems = items
    .filter(item => activeTab === 'all' ? true : item.cosmetic_type === activeTab)
    .sort((a, b) => {
      const aRarity = rarityOrder[a.rarity?.toLowerCase()] || 5;
      const bRarity = rarityOrder[b.rarity?.toLowerCase()] || 5;
      return aRarity - bRarity;
    })

  if (loading) {
    return <LoadingScreen title="Opening the rewards shop" subtitle="Checking your coins and loading the latest items." />
  }

  const shopTabs = [
    { id: 'all', label: 'All items', icon: ShoppingBagIcon },
    { id: 'background', label: 'Backgrounds', icon: ImageIcon },
    { id: 'quiz_theme', label: 'Quiz themes', icon: PaletteIcon },
    { id: 'avatar_border', label: 'Avatar borders', icon: StarIcon },
  ]
  const ownedCount = items.filter((item) => inventory.includes(item.id)).length

  return (
    <div className="rewards-shop-page">
      <div className="rewards-shop-ambient" aria-hidden="true" />
      {equippedBackground && (
        <div className="rewards-shop-background" aria-hidden="true">
          <img src={equippedBackground} alt="" />
        </div>
      )}

      <aside className="rewards-shop-sidebar">
        <button className="rewards-shop-brand" onClick={() => navigate('/dashboard')} aria-label="SabTa home">
          <span className="rewards-shop-brand__mark"><img src={sabtaLogo} alt="" /></span>
          <span className="rewards-shop-brand__word">SAB<span>TA</span><small>PLAYER ARENA</small></span>
        </button>
        <span className="rewards-shop-sidebar__label">MENU</span>
        <nav className="rewards-shop-nav" aria-label="Main navigation">
          <button onClick={() => navigate('/dashboard')}><HouseIcon weight="fill" /><span>Overview</span></button>
          <button onClick={() => navigate('/quizzes')}><GameControllerIcon weight="fill" /><span>Play quiz</span></button>
          <button onClick={() => navigate('/leaderboard')}><TrophyIcon weight="fill" /><span>Leaderboard</span></button>
          <button onClick={() => navigate('/clans')}><ShieldIcon weight="fill" /><span>Clans</span></button>
          <button className="is-active" aria-current="page"><ShoppingBagIcon weight="fill" /><span>Rewards shop</span></button>
          <button onClick={() => navigate('/profile')}><UserIcon weight="fill" /><span>My profile</span></button>
        </nav>
        <button className="rewards-shop-sidebar__logout" onClick={handleLogout}><SignOutIcon weight="fill" /> Logout</button>
      </aside>

      <main className="rewards-shop-main">
        <header className="rewards-shop-topbar">
          <button className="rewards-shop-brand rewards-shop-brand--mobile" onClick={() => navigate('/dashboard')} aria-label="SabTa home">
            <span className="rewards-shop-brand__mark"><img src={sabtaLogo} alt="" /></span>
            <span className="rewards-shop-brand__word">SAB<span>TA</span></span>
          </button>
          <div className="rewards-shop-breadcrumb"><span>PLAYER HUB</span><i>/</i> REWARDS SHOP</div>
          <div className="rewards-shop-topbar__right">
            <span className="rewards-shop-wallet"><CoinsIcon weight="fill" /><strong>{(profile?.coins || 0).toLocaleString()}</strong><small>COINS</small></span>
            <button className="rewards-shop-topbar__logout" onClick={handleLogout} aria-label="Log out"><SignOutIcon weight="bold" /></button>
          </div>
        </header>

        <div className="rewards-shop-content">
          <section className="rewards-shop-hero">
            <div className="rewards-shop-hero__copy">
              <span className="rewards-shop-eyebrow"><SparkleIcon weight="fill" /> THE REWARDS VAULT</span>
              <h1>Make the arena<br /><span>your own.</span></h1>
              <p>Find your next look. Unlock a new backdrop. Build a loadout that feels like you.</p>
              <div className="rewards-shop-hero__meta"><span><span /> {items.length} ITEMS TO DISCOVER</span><i /> <span>{ownedCount} IN YOUR COLLECTION</span></div>
            </div>
            <div className="rewards-shop-hero__wallet">
              <span className="rewards-shop-hero__coin"><CoinsIcon weight="fill" /></span>
              <small>YOUR COIN BALANCE</small>
              <strong>{(profile?.coins || 0).toLocaleString()}</strong>
              <span className="rewards-shop-hero__wallet-label">READY TO SPEND</span>
            </div>
            <span className="rewards-shop-hero__orb rewards-shop-hero__orb--one" aria-hidden="true" />
            <span className="rewards-shop-hero__orb rewards-shop-hero__orb--two" aria-hidden="true" />
          </section>

          <section className="rewards-shop-controls" aria-label="Shop categories">
            <div className="rewards-shop-controls__heading"><span>THE COLLECTION</span><small>Browse by category</small></div>
            <div className="rewards-shop-tabs" role="tablist" aria-label="Cosmetic category">
              {shopTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={activeTab === tab.id ? 'is-active' : ''}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon weight={activeTab === tab.id ? 'fill' : 'regular'} />
                  <span>{tab.label}</span>
                  <small>{tab.id === 'all' ? items.length : items.filter((item) => item.cosmetic_type === tab.id).length}</small>
                </button>
              ))}
            </div>
            <span className="rewards-shop-sort"><MagnifyingGlassIcon /> {filteredItems.length} RESULTS</span>
          </section>

          <div className="rewards-shop-grid">
            {filteredItems.length === 0 ? (
              <div className="rewards-shop-empty">
                <span><ShoppingBagIcon weight="duotone" /></span>
                <strong>Nothing in this collection yet</strong>
                <p>Check back soon for fresh cosmetics.</p>
              </div>
            ) : (
              filteredItems.map((item, index) => {
                const isOwned = inventory.includes(item.id)
                const canAfford = (profile?.coins || 0) >= item.price
                const rarity = item.rarity?.toLowerCase() || 'common'

                return (
                  <article key={item.id} className={`rewards-item rewards-item--${rarity}`} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                    <button className="rewards-item__preview" onClick={() => setSelectedItem(item)} aria-label={`View ${item.name}`}>
                      {item.preview_url ? (
                        <img src={item.preview_url} alt={item.name} />
                      ) : (
                        <span className="rewards-item__no-preview"><ImageIcon weight="duotone" /> No preview</span>
                      )}
                      <span className={`rewards-item__rarity rewards-item__rarity--${rarity}`}>{item.rarity || 'Common'}</span>
                      {isOwned && <span className="rewards-item__owned"><CheckCircleIcon weight="fill" /> OWNED</span>}
                      <span className="rewards-item__view"><EyeIcon weight="bold" /></span>
                    </button>
                    <div className="rewards-item__body">
                      <div className="rewards-item__copy">
                        <span>{item.cosmetic_type === 'avatar_border' ? 'AVATAR BORDER' : item.cosmetic_type === 'quiz_theme' ? 'QUIZ THEME' : 'PROFILE BACKGROUND'}</span>
                        <h2>{item.name}</h2>
                        <p>{item.description || 'A fresh addition to your collection.'}</p>
                      </div>
                      <div className="rewards-item__footer">
                        {isOwned ? (
                          <span className="rewards-item__owned-label"><CheckCircleIcon weight="fill" /> In your collection</span>
                        ) : (
                          <>
                            <span className="rewards-item__price"><CoinsIcon weight="fill" /> {item.price.toLocaleString()}</span>
                            <button
                              className={`rewards-item__buy ${canAfford ? '' : 'is-locked'}`}
                              onClick={() => setPurchaseItem(item)}
                              disabled={!canAfford}
                            >
                              {canAfford ? 'Get item' : 'Need more'} <CaretRightIcon weight="bold" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      </main>

      <nav className="rewards-shop-mobile-nav" aria-label="Mobile navigation">
        <button onClick={() => navigate('/dashboard')}><HouseIcon weight="fill" /><span>Home</span></button>
        <button onClick={() => navigate('/quizzes')}><GameControllerIcon weight="fill" /><span>Play</span></button>
        <button onClick={() => navigate('/leaderboard')}><TrophyIcon weight="fill" /><span>Ranks</span></button>
        <button onClick={() => navigate('/clans')}><ShieldIcon weight="fill" /><span>Clans</span></button>
        <button className="is-active" aria-current="page"><ShoppingBagIcon weight="fill" /><span>Shop</span></button>
        <button onClick={() => navigate('/profile')}><UserIcon weight="fill" /><span>Profile</span></button>
      </nav>

      {/* FULL DETAILS MODAL */}
      <ModalPresence
        open={!!selectedItem && !purchaseItem}
        className="rewards-shop-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        panelClassName="w-full max-w-md"
      >
        {selectedItem && !purchaseItem && (
          <div className="rewards-shop-modal bg-[#0f1014] border border-white/10 rounded-[2rem] p-5 md:p-8 w-full text-center relative shadow-2xl max-h-[90vh] overflow-y-auto mb-16 md:mb-0 scrollbar-hide">
            <button 
              onClick={() => setSelectedItem(null)} 
              className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 p-2 rounded-full transition z-10"
            >
              <XIcon weight="bold" className="w-5 h-5" />
            </button>

            <div className="w-full h-40 md:h-64 bg-black/40 rounded-2xl mb-4 md:mb-6 flex items-center justify-center p-4 md:p-6 border border-white/5">
              {selectedItem.preview_url ? (
                <img src={selectedItem.preview_url} alt={selectedItem.name} className="w-full h-full object-contain" />
              ) : (
                <ImageIcon weight="duotone" className="w-16 h-16 text-gray-600" />
              )}
            </div>

            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10 mb-3 md:mb-4 ${
              selectedItem.rarity === 'legendary' ? 'text-[#ff00a0]' :
              selectedItem.rarity === 'epic' ? 'text-[#ccff00]' :
              selectedItem.rarity === 'rare' ? 'text-[#00f0ff]' :
              'text-gray-300'
            }`}>
              {selectedItem.rarity || 'Common'}
            </span>

            <h2 className="text-xl md:text-2xl font-bold text-white mb-2">{selectedItem.name}</h2>
            <p className="text-gray-400 text-xs md:text-sm mb-4 md:mb-6">{selectedItem.description}</p>

            <div className="flex items-center justify-between bg-black/50 border border-white/5 rounded-xl p-3 md:p-4 mb-4 md:mb-6">
              <span className="text-xs md:text-sm font-semibold text-gray-300">Price</span>
              <div className="flex items-center gap-1.5 text-[#ff00a0] font-bold text-lg md:text-xl">
                <CoinsIcon weight="fill" /> {selectedItem.price}
              </div>
            </div>

            {inventory.includes(selectedItem.id) ? (
              <div className="py-3 bg-green-500/10 text-green-400 rounded-xl font-bold flex items-center justify-center gap-2">
                <CheckCircleIcon weight="fill" /> Already Owned
              </div>
            ) : (
              <button 
                onClick={() => setPurchaseItem(selectedItem)}
                disabled={(profile?.coins || 0) < selectedItem.price}
                className={`rewards-shop-buy-now w-full py-3 rounded-xl font-bold transition ${
                  (profile?.coins || 0) >= selectedItem.price 
                    ? 'bg-[#ccff00] text-black hover:bg-white' 
                    : 'bg-white/5 text-gray-500 cursor-not-allowed'
                }`}
              >
                {(profile?.coins || 0) >= selectedItem.price ? 'Buy Now' : 'Not Enough Coins'}
              </button>
            )}
          </div>
        )}
      </ModalPresence>

      {/* PURCHASE CONFIRMATION MODAL */}
      <ModalPresence
        open={!!purchaseItem}
        className="rewards-shop-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        panelClassName="w-full max-w-sm"
      >
        {purchaseItem && (
          <div className="rewards-shop-modal rewards-shop-confirmation w-full relative text-center">
            <div className="rewards-shop-confirmation__icon" aria-hidden="true">
              <ShoppingBagIcon weight="fill" />
            </div>
            <span className="rewards-shop-confirmation__eyebrow">SHOP CHECKOUT</span>
            <h2>Confirm Purchase</h2>
            <p className="rewards-shop-confirmation__copy">This item will be added to your collection.</p>

            <div className="rewards-shop-confirmation__item">
              <span>YOU'RE GETTING</span>
              <strong>{purchaseItem.name}</strong>
              <div className="rewards-shop-confirmation__price">
                <CoinsIcon weight="fill" />
                <strong>{purchaseItem.price.toLocaleString()}</strong>
                <span>COINS</span>
              </div>
            </div>

            <div className="rewards-shop-confirmation__actions flex gap-3">
              <button 
                onClick={() => setPurchaseItem(null)} 
                disabled={purchasing}
                className="rewards-shop-confirmation__cancel flex-1"
              >
                Cancel
              </button>
              <button 
                onClick={handlePurchase} 
                disabled={purchasing}
                className="rewards-shop-confirmation__confirm flex-1"
              >
                {purchasing ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        )}
      </ModalPresence>

      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl font-bold text-sm shadow-2xl border flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon weight="fill" /> : <XCircleIcon weight="fill" />}
          {toast.msg}
        </div>
      )}

    </div>
  )
}