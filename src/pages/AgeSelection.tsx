// src/pages/AgeSelection.tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { 
  PlantIcon, 
  RocketIcon, 
  BrainIcon, 
  CheckIcon, 
  ArrowRightIcon,
  LightningIcon
} from '@phosphor-icons/react'

export default function AgeSelection() {
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ageGroups = [
    { 
      id: 'kids', 
      icon: PlantIcon, 
      title: 'Kids', 
      ages: '6–12', 
      color: 'green', 
      desc: 'Fun and colorful questions designed just for young minds.',
      gradient: 'from-green-500/20 via-green-500/5 to-transparent',
      border: 'border-green-500/50',
      glow: 'shadow-[0_0_40px_rgba(34,197,94,0.2)]'
    },
    { 
      id: 'teens', 
      icon: RocketIcon, 
      title: 'Teens', 
      ages: '13–17', 
      color: 'cyan', 
      desc: 'Challenging questions across science, history, and pop culture.',
      gradient: 'from-[#00f0ff]/20 via-[#00f0ff]/5 to-transparent',
      border: 'border-[#00f0ff]/50',
      glow: 'shadow-[0_0_40px_rgba(0,240,255,0.2)]'
    },
    { 
      id: 'adults', 
      icon: BrainIcon, 
      title: 'Adults', 
      ages: '18+', 
      color: 'pink', 
      desc: 'Advanced trivia and complex problems for experienced players.',
      gradient: 'from-[#ff00a0]/20 via-[#ff00a0]/5 to-transparent',
      border: 'border-[#ff00a0]/50',
      glow: 'shadow-[0_0_40px_rgba(255,0,160,0.2)]'
    },
  ]

  const handleConfirm = async () => {
    if (!selected) return
    setLoading(true)
    setError(null)

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('No user found. Please log in again.')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ age_category: selected })
        .eq('id', user.id)

      if (updateError) throw updateError
      window.location.href = '/dashboard' 
    } catch (err: any) {
      console.error("Error saving age:", err)
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center p-4 sm:p-6 relative overflow-y-auto pb-32">
      
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />

      <div className="relative z-10 max-w-5xl w-full mt-2 sm:mt-10">
        
        {/* Header */}
        <div className="text-center mb-8 sm:mb-14">
          <h1 className="text-3xl sm:text-5xl font-black mb-2 tracking-tight">
            CHOOSE YOUR <span className="text-[#ccff00]">TIER</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Select your age group to tailor your quiz experience.
          </p>
        </div>

        {/* Cards Layout */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mb-10">
          {ageGroups.map((group, index) => {
            const Icon = group.icon
            const isSelected = selected === group.id
            
            // Desktop focus effect
            let desktopEffect = 'sm:scale-100 sm:opacity-100'
            if (index === 0 || index === 2) {
              desktopEffect = 'sm:scale-[0.85] sm:opacity-60 hover:sm:opacity-100 hover:sm:scale-[0.9]'
            }
            if (index === 1) {
              desktopEffect = 'sm:scale-[1.05] z-10'
            }
            if (isSelected && index !== 1) {
              desktopEffect = 'sm:scale-100 sm:opacity-100'
            }

            return (
              <button
                key={group.id}
                onClick={() => setSelected(group.id)}
                className={`relative overflow-hidden rounded-2xl sm:rounded-3xl border transition-all duration-500 ease-out group text-left flex flex-row sm:flex-col items-center sm:items-start p-4 sm:p-8 w-full sm:w-[300px] sm:min-h-[360px] ${desktopEffect} ${
                  isSelected 
                    ? `${group.border} ${group.glow} bg-[#0f1014]` 
                    : 'border-white/10 hover:border-white/30 bg-[#0f1014]'
                }`}
              >
                {/* Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-r sm:bg-gradient-to-t ${group.gradient} opacity-0 transition-opacity duration-500 ${
                  isSelected ? 'opacity-100' : 'sm:group-hover:opacity-50'
                }`} />
                
                {/* Giant Background Icon */}
                <Icon 
                  weight="duotone" 
                  className={`absolute -right-4 -bottom-4 w-28 h-28 sm:-right-6 sm:-bottom-6 sm:w-56 sm:h-56 opacity-5 transition-transform duration-700 group-hover:scale-110 group-hover:-rotate-12 pointer-events-none ${
                    isSelected ? 'opacity-15 sm:opacity-20 text-white' : ''
                  }`} 
                />

                {/* Selected Checkmark Badge */}
                {isSelected && (
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 sm:top-6 sm:-translate-y-0 sm:right-6 w-7 h-7 sm:w-8 sm:h-8 bg-[#ccff00] rounded-full flex items-center justify-center text-black animate-in zoom-in shrink-0 shadow-lg z-20">
                    <CheckIcon weight="bold" size={16} className="sm:w-[18px] sm:h-[18px]" />
                  </div>
                )}

                {/* Icon */}
                <div className={`relative z-10 w-10 h-10 sm:w-16 sm:h-16 rounded-xl shrink-0 sm:mb-6 flex items-center justify-center backdrop-blur-md border transition-colors mr-4 sm:mr-0 ${
                  isSelected ? 'bg-white/20 border-white/30 text-white' : 
                  group.color === 'green' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                  group.color === 'cyan' ? 'bg-[#00f0ff]/10 border-[#00f0ff]/20 text-[#00f0ff]' :
                  'bg-[#ff00a0]/10 border-[#ff00a0]/20 text-[#ff00a0]'
                }`}>
                  <Icon weight="fill" size={22} className="sm:w-7 sm:h-7" />
                </div>

                {/* Content */}
                <div className="relative z-10 flex-1 pr-8 sm:pr-0">
                  <h3 className="text-lg sm:text-2xl font-black text-white mb-0.5 sm:mb-1">{group.title}</h3>
                  <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest sm:mb-3">Ages {group.ages}</p>
                  
                  {/* Description hidden on mobile to save space, shown on desktop */}
                  <p className={`hidden sm:block text-sm transition-all duration-300 ${
                    isSelected ? 'text-gray-200' : 'text-gray-500 group-hover:text-gray-300'
                  }`}>
                    {group.desc}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center text-sm max-w-md mx-auto">
            {error}
          </div>
        )}

        {/* Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 sm:relative sm:bottom-auto p-4 sm:p-0 bg-[#050505]/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-t border-white/10 sm:border-none z-50">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 bg-[#0f1014] border border-white/10 p-3 sm:p-4 rounded-2xl sm:rounded-3xl max-w-2xl mx-auto sm:backdrop-blur-xl shadow-2xl">
            <div className="hidden sm:flex items-center gap-3 text-sm text-gray-400 font-medium px-2">
              <LightningIcon weight="fill" className="text-[#ccff00]" />
              {selected ? 'Ready to enter the arena!' : 'Select a tier to continue'}
            </div>
            
            <button
              onClick={handleConfirm}
              disabled={!selected || loading}
              className={`flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3.5 rounded-xl sm:rounded-2xl font-black uppercase tracking-wider transition-all duration-300 ${
                selected 
                  ? 'bg-[#ccff00] text-black hover:bg-white sm:hover:scale-105 shadow-[0_0_20px_rgba(204,255,0,0.4)]' 
                  : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }`}
            >
              {loading ? 'Saving...' : 'Confirm'}
              {!loading && <ArrowRightIcon weight="bold" />}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}