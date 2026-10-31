// src/pages/RewardsShop.tsx
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  CoinsIcon, SignOutIcon, HouseIcon, GameControllerIcon, TrophyIcon,
  ShoppingBagIcon, UserIcon, CheckCircleIcon, StarIcon, PaletteIcon,
  ImageIcon, XCircleIcon, XIcon, EyeIcon, ShieldIcon // 👈 ADDED ShieldIcon
} from '@phosphor-icons/react'
import sabtaLogo from '../assets/icons/sabta-logo.png'

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
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">
        LOADING SHOP...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex relative">
      
      {equippedBackground && (
        <div className="fixed inset-0 z-0 pointer-events-none w-full h-full overflow-hidden">
          <img 
            src={equippedBackground} 
            alt="bg" 
            className="w-full h-full object-cover opacity-70 md:opacity-50 scale-105" 
          />
          <div className="absolute inset-0 bg-[#050505]/40 md:bg-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505]/60 via-transparent to-[#050505] md:bg-gradient-to-br md:from-[#050505]/90 md:via-[#050505]/50 md:to-transparent" />
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0f1014]/90 backdrop-blur-xl flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
        <div className="flex items-center gap-3 mb-8 px-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-10 h-10 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center overflow-hidden">
             <img src={sabtaLogo} alt="SabTa" className="w-8 h-8 object-contain" />
          </div>
          <span className="text-2xl font-bold tracking-tighter">SAB<span className="text-[#ccff00]">TA</span></span>
        </div>
        <nav className="flex flex-col w-full gap-2">
          <button onClick={() => navigate('/dashboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <HouseIcon weight="fill" className="w-6 h-6" /> Home
          </button>
          <button onClick={() => navigate('/quizzes')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz
          </button>
          <button onClick={() => navigate('/leaderboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <TrophyIcon weight="fill" className="w-6 h-6" /> Leaderboard
          </button>
          {/* 👇 ADDED CLANS BUTTON HERE 👇 */}
          <button onClick={() => navigate('/clans')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <ShieldIcon weight="fill" className="w-6 h-6" /> Clans
          </button>
          <button className="flex items-center gap-4 w-full p-3 rounded-xl bg-[#ccff00]/10 text-[#ccff00] font-bold transition">
            <ShoppingBagIcon weight="fill" className="w-6 h-6" /> Rewards Shop
          </button>
          <button onClick={() => navigate('/profile')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <UserIcon weight="fill" className="w-6 h-6" /> My Profile
          </button>
        </nav>
        <div className="mt-auto w-full">
          <button onClick={handleLogout} className="flex items-center gap-4 w-full p-3 rounded-xl text-red-400 hover:bg-red-500/10 font-semibold transition">
            <SignOutIcon weight="fill" className="w-6 h-6" /> Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative z-10 w-full overflow-x-hidden">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 relative z-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">Rewards Shop</h1>
            <p className="text-gray-400 text-xs md:text-sm">Spend your coins on exclusive cosmetics.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-black/50 backdrop-blur-md border border-[#ff00a0]/30 px-4 py-2 rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(255,0,160,0.1)]">
              <CoinsIcon weight="fill" className="text-[#ff00a0] w-5 h-5" />
              <span className="font-bold text-[#ff00a0] text-lg">{profile?.coins || 0} COINS</span>
            </div>
            <button onClick={handleLogout} className="md:hidden bg-red-500/10 text-red-400 p-2.5 rounded-xl border border-red-500/20">
              <SignOutIcon weight="bold" className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="flex overflow-x-auto gap-2 mb-8 pb-2 relative z-10 scrollbar-hide">
          {[
            { id: 'all', label: 'All Items', icon: ShoppingBagIcon },
            { id: 'background', label: 'Backgrounds', icon: ImageIcon },
            { id: 'quiz_theme', label: 'Quiz Themes', icon: PaletteIcon },
            { id: 'avatar_border', label: 'Borders', icon: StarIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap font-semibold text-sm transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#ccff00] text-black shadow-[0_0_15px_rgba(204,255,0,0.2)]' 
                  : 'bg-black/40 backdrop-blur-md text-gray-400 border border-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              <tab.icon weight={activeTab === tab.id ? "fill" : "regular"} className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ITEMS GRID */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6 relative z-10 w-full">
          {filteredItems.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-black/40 backdrop-blur-md rounded-3xl border border-white/10">
              <ShoppingBagIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-bold mb-1">No items available</p>
              <p className="text-gray-500 text-sm">Check back later for new cosmetics!</p>
            </div>
          ) : (
            filteredItems.map(item => {
              const isOwned = inventory.includes(item.id)
              const canAfford = (profile?.coins || 0) >= item.price

              return (
                <div key={item.id} className="bg-black/50 backdrop-blur-xl border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden group hover:border-white/20 transition-all flex flex-col min-w-0 w-full shadow-lg">
                  
                  <div 
                    className="h-28 md:h-48 bg-black/30 relative flex items-center justify-center overflow-hidden border-b border-white/5 p-1 md:p-4 cursor-pointer"
                    onClick={() => setSelectedItem(item)}
                  >
                    {item.preview_url ? (
                      <img src={item.preview_url} alt={item.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="text-gray-600 flex flex-col items-center">
                        <ImageIcon weight="duotone" className="w-6 h-6 mb-1" />
                        <span className="text-[10px]">No Preview</span>
                      </div>
                    )}
                    
                    <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 bg-black/60 backdrop-blur-md px-1.5 md:px-3 py-0.5 md:py-1 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-wider border border-white/10 pointer-events-none">
                      <span className={`${
                        item.rarity === 'legendary' ? 'text-[#ff00a0]' :
                        item.rarity === 'epic' ? 'text-[#ccff00]' :
                        item.rarity === 'rare' ? 'text-[#00f0ff]' :
                        'text-gray-300'
                      }`}>{item.rarity || 'Common'}</span>
                    </div>
                  </div>

                  <div className="p-2 md:p-5 flex-1 flex flex-col min-w-0">
                    
                    <div className="mb-2 md:mb-4 cursor-pointer flex flex-col justify-between items-start gap-1" onClick={() => setSelectedItem(item)}>
                      <div className="flex-1 min-w-0 w-full">
                        <h3 className="text-[11px] md:text-lg font-bold text-white mb-0.5 hover:text-[#ccff00] transition truncate leading-tight w-full">{item.name}</h3>
                        <p className="hidden md:block text-xs text-gray-400 line-clamp-2">{item.description}</p>
                      </div>
                      {!isOwned && (
                        <div className="flex items-center gap-1 font-bold text-[#ff00a0] text-[10px] md:text-base shrink-0 mt-1">
                          <CoinsIcon weight="fill" className="w-3 h-3 md:w-4 md:h-4" /> 
                          <span>{item.price}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-2 md:pt-4 border-t border-white/5 w-full">
                      {isOwned ? (
                        <div className="flex items-center justify-center gap-1 text-green-400 font-bold text-[9px] md:text-sm bg-green-500/10 px-1 py-1.5 rounded-lg w-full">
                          <CheckCircleIcon weight="fill" className="w-3 h-3 md:w-4 md:h-4" /> Owned
                        </div>
                      ) : (
                        <div className="flex gap-1.5 w-full">
                          <button
                            onClick={() => setSelectedItem(item)}
                            className="flex-none flex items-center justify-center p-1.5 md:p-2.5 rounded-lg md:rounded-xl font-bold transition bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white"
                            title="View Details"
                          >
                            <EyeIcon weight="bold" className="w-3 h-3 md:w-5 md:h-5" />
                          </button>

                          <button
                            onClick={() => setPurchaseItem(item)}
                            disabled={!canAfford}
                            className={`flex-1 px-1 md:px-5 py-1.5 md:py-2.5 rounded-lg md:rounded-xl font-bold text-[10px] md:text-sm transition text-center ${
                              canAfford 
                                ? 'bg-white text-black hover:bg-[#ccff00] shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {canAfford ? 'Buy' : 'Locked'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>

      {/* FULL DETAILS MODAL */}
      {selectedItem && !purchaseItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-[2rem] p-5 md:p-8 max-w-md w-full text-center relative shadow-2xl max-h-[90vh] overflow-y-auto mb-16 md:mb-0 scrollbar-hide">
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
                className={`w-full py-3 rounded-xl font-bold transition ${
                  (profile?.coins || 0) >= selectedItem.price 
                    ? 'bg-[#ccff00] text-black hover:bg-white' 
                    : 'bg-white/5 text-gray-500 cursor-not-allowed'
                }`}
              >
                {(profile?.coins || 0) >= selectedItem.price ? 'Buy Now' : 'Not Enough Coins'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* PURCHASE CONFIRMATION MODAL */}
      {purchaseItem && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 md:p-8 max-w-sm w-full text-center relative shadow-2xl">
            <h2 className="text-2xl font-bold mb-2">Confirm Purchase</h2>
            <p className="text-gray-400 text-sm mb-6">Are you sure you want to buy this item?</p>
            
            <div className="bg-black/50 border border-white/5 rounded-2xl p-4 mb-6">
              <p className="font-bold text-white mb-1">{purchaseItem.name}</p>
              <div className="flex items-center justify-center gap-1 text-[#ff00a0] font-bold text-xl mt-2">
                <CoinsIcon weight="fill" /> {purchaseItem.price} COINS
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setPurchaseItem(null)} 
                disabled={purchasing}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                onClick={handlePurchase} 
                disabled={purchasing}
                className="flex-1 py-3 bg-[#ccff00] text-black hover:bg-white rounded-xl font-bold transition disabled:opacity-50"
              >
                {purchasing ? 'Buying...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-xl font-bold text-sm shadow-2xl border flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
        }`}>
          {toast.type === 'success' ? <CheckCircleIcon weight="fill" /> : <XCircleIcon weight="fill" />}
          {toast.msg}
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <HouseIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Home</span>
        </button>
        <button onClick={() => navigate('/quizzes')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <GameControllerIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Play</span>
        </button>
        <button onClick={() => navigate('/leaderboard')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <TrophyIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Ranks</span>
        </button>
        {/* 👇 ADDED CLANS BUTTON TO MOBILE BOTTOM NAV 👇 */}
        <button onClick={() => navigate('/clans')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <ShieldIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Clans</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-[#ccff00]">
          <ShoppingBagIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Shop</span>
        </button>
        <button onClick={() => navigate('/profile')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <UserIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Profile</span>
        </button>
      </nav>
    </div>
  )
}