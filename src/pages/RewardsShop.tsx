import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  LightningIcon,
  SignOutIcon,
  HouseIcon,
  GameControllerIcon,
  TrophyIcon,
  ShoppingBagIcon,
  UserIcon,
  CheckCircleIcon,
  StarIcon,
  PaletteIcon,
  ImageIcon,
} from '@phosphor-icons/react'

import sabtaLogo from '../assets/icons/sabta-logo.png'

export default function RewardsShop() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<any>(null)
  const [inventory, setInventory] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  
  // Purchase State
  const [selectedItem, setSelectedItem] = useState<any>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [activeTab, setActiveTab] = useState('all') // 'all', 'background', 'theme', 'border'

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return navigate('/')

      // 1. Fetch Profile (for points)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (profileData) setProfile(profileData)

      // 2. Fetch User Inventory (what they already own)
      const { data: inventoryData } = await supabase
        .from('user_inventory')
        .select('cosmetic_item_id')
        .eq('user_id', user.id)
      
      if (inventoryData) {
        setInventory(inventoryData.map(i => i.cosmetic_item_id))
      }

      // 3. Fetch Available Items
      const { data: itemsData } = await supabase
        .from('cosmetic_items')
        .select('*')
        .eq('status', 'published')
        .order('price', { ascending: true })

      if (itemsData) setItems(itemsData)

      setLoading(false)
    }

    fetchData()
  }, [navigate])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const handlePurchase = async () => {
    if (!selectedItem || purchasing) return
    
    if (profile.points < selectedItem.price) {
      alert("You don't have enough points for this item!")
      return
    }

    setPurchasing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // 1. Deduct Points from Profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ points: profile.points - selectedItem.price })
        .eq('id', user.id)

      if (profileError) throw profileError

      // 2. Add Item to User Inventory
      const { error: inventoryError } = await supabase
        .from('user_inventory')
        .insert({
          user_id: user.id,
          cosmetic_item_id: selectedItem.id,
          is_equipped: false
        })

      if (inventoryError) throw inventoryError

      // 3. Update Local State (to reflect instantly)
      setProfile({ ...profile, points: profile.points - selectedItem.price })
      setInventory([...inventory, selectedItem.id])
      setSelectedItem(null)

    } catch (err: any) {
      console.error("Purchase failed:", err)
      alert("Failed to complete purchase. Please try again.")
    } finally {
      setPurchasing(false)
    }
  }

  // Filter items based on active tab
  const filteredItems = items.filter(item => 
    activeTab === 'all' ? true : item.cosmetic_type === activeTab
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ccff00] flex items-center justify-center text-xl font-bold font-mono">
        LOADING SHOP...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-64 border-r border-white/10 bg-[#0f1014] flex-col items-start py-8 px-4 gap-4 fixed h-full z-20">
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
          <button onClick={() => navigate('/play/new')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <GameControllerIcon weight="fill" className="w-6 h-6" /> Play Quiz
          </button>
          <button onClick={() => navigate('/leaderboard')} className="flex items-center gap-4 w-full p-3 rounded-xl text-gray-400 hover:bg-white/5 hover:text-white font-semibold transition">
            <TrophyIcon weight="fill" className="w-6 h-6" /> Leaderboard
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
      <main className="flex-1 lg:ml-64 p-4 pb-28 lg:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-[#ff00a0]/5 rounded-full blur-[100px] pointer-events-none" />

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 relative z-10">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">Rewards Shop</h1>
            <p className="text-gray-400 text-xs md:text-sm">Spend your points on exclusive cosmetics.</p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            <div className="bg-[#0f1014] border border-[#ccff00]/30 px-4 py-2 rounded-xl flex items-center gap-2 shadow-[0_0_15px_rgba(204,255,0,0.1)]">
              <LightningIcon weight="fill" className="text-[#ccff00] w-5 h-5" />
              <span className="font-bold text-[#ccff00] text-lg">{profile?.points || 0} PTS</span>
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
            { id: 'theme', label: 'Quiz Themes', icon: PaletteIcon },
            { id: 'border', label: 'Borders', icon: StarIcon },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap font-semibold text-sm transition-all ${
                activeTab === tab.id 
                  ? 'bg-[#ccff00] text-black' 
                  : 'bg-[#0f1014] text-gray-400 border border-white/5 hover:border-white/20 hover:text-white'
              }`}
            >
              <tab.icon weight={activeTab === tab.id ? "fill" : "regular"} className="w-5 h-5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
          {filteredItems.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-[#0f1014] rounded-3xl border border-white/10">
              <ShoppingBagIcon weight="duotone" className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 font-bold mb-1">No items available</p>
              <p className="text-gray-500 text-sm">Check back later for new cosmetics!</p>
            </div>
          ) : (
            filteredItems.map(item => {
              const isOwned = inventory.includes(item.id)
              const canAfford = profile.points >= item.price

              return (
                <div key={item.id} className="bg-[#0f1014] border border-white/10 rounded-3xl overflow-hidden group hover:border-white/20 transition-all flex flex-col">
                  {/* Preview Image Area */}
                  <div className="h-40 bg-black/50 relative flex items-center justify-center overflow-hidden border-b border-white/5">
                    {item.preview_url ? (
                      <img src={item.preview_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="text-gray-600 flex flex-col items-center">
                        <ImageIcon weight="duotone" className="w-10 h-10 mb-2" />
                        <span className="text-xs">No Preview</span>
                      </div>
                    )}
                    
                    {/* Rarity Badge */}
                    <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border border-white/10">
                      <span className={`${
                        item.rarity === 'legendary' ? 'text-[#ff00a0]' :
                        item.rarity === 'epic' ? 'text-[#ccff00]' :
                        item.rarity === 'rare' ? 'text-[#00f0ff]' :
                        'text-gray-300'
                      }`}>{item.rarity || 'Common'}</span>
                    </div>
                  </div>

                  {/* Info Area */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="mb-4">
                      <h3 className="text-lg font-bold text-white mb-1">{item.name}</h3>
                      <p className="text-sm text-gray-400 line-clamp-2">{item.description}</p>
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
                      {isOwned ? (
                        <div className="flex items-center gap-1.5 text-green-400 font-bold text-sm bg-green-500/10 px-3 py-1.5 rounded-lg w-full justify-center">
                          <CheckCircleIcon weight="fill" /> Already Owned
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 font-bold text-[#ccff00]">
                            <LightningIcon weight="fill" /> {item.price}
                          </div>
                          <button
                            onClick={() => setSelectedItem(item)}
                            disabled={!canAfford}
                            className={`px-5 py-2 rounded-xl font-bold text-sm transition ${
                              canAfford 
                                ? 'bg-white text-black hover:bg-[#ccff00]' 
                                : 'bg-white/5 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            {canAfford ? 'Buy' : 'Locked'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </main>

      {/* PURCHASE CONFIRMATION MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f1014] border border-white/10 rounded-3xl p-6 md:p-8 max-w-sm w-full text-center relative shadow-2xl">
            <h2 className="text-2xl font-bold mb-2">Confirm Purchase</h2>
            <p className="text-gray-400 text-sm mb-6">Are you sure you want to buy this item?</p>
            
            <div className="bg-black/50 border border-white/5 rounded-2xl p-4 mb-6">
              <p className="font-bold text-white mb-1">{selectedItem.name}</p>
              <div className="flex items-center justify-center gap-1 text-[#ccff00] font-bold text-xl">
                <LightningIcon weight="fill" /> {selectedItem.price} PTS
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setSelectedItem(null)} 
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

      {/* MOBILE BOTTOM NAVIGATION */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#0f1014]/95 backdrop-blur-md border-t border-white/10 flex justify-around items-center h-16 z-50 px-2">
        <button onClick={() => navigate('/dashboard')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <HouseIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Home</span>
        </button>
        <button onClick={() => navigate('/play/new')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <GameControllerIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Play</span>
        </button>
        <button onClick={() => navigate('/leaderboard')} className="flex flex-col items-center gap-1 text-gray-400 hover:text-white transition">
          <TrophyIcon weight="fill" className="w-5 h-5" />
          <span className="text-[9px] font-bold">Ranks</span>
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