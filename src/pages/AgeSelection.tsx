// src/pages/AgeSelection.tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { 
  PlantIcon, 
  RocketIcon, 
  BrainIcon, 
  CheckCircleIcon, 
  ArrowRightIcon,
  SparkleIcon
} from '@phosphor-icons/react'

export default function AgeSelection() {
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ageGroups = [
    { id: 'kids', icon: PlantIcon, title: 'Kids', ages: '6–12', color: 'green', desc: 'Fun and colorful questions designed just for young minds.' },
    { id: 'teens', icon: RocketIcon, title: 'Teens', ages: '13–17', color: 'cyan', desc: 'Challenging questions across science, history, and pop culture.' },
    { id: 'adults', icon: BrainIcon, title: 'Adults', ages: '18+', color: 'pink', desc: 'Advanced trivia and complex problems for experienced players.' },
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
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center p-4 sm:p-6 relative overflow-y-auto pb-28">
      
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] rounded-full bg-[#00f0ff]/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] rounded-full bg-[#ccff00]/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl w-full mt-6 sm:mt-12 flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-[#ccff00] uppercase tracking-wider mb-4 sm:mb-6">
            <SparkleIcon weight="fill" />
            Step 1 of 1
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3">
            Select Your <span className="text-[#ccff00]">Age Group</span>
          </h1>
          <p className="text-gray-400 text-sm sm:text-base max-w-md mx-auto">
            This helps us customize your quiz difficulty, UI themes, and leaderboard tiers.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 w-full mb-8 sm:mb-12">
          {ageGroups.map((group) => {
            const Icon = group.icon
            const isSelected = selected === group.id

            return (
              <button
                key={group.id}
                onClick={() => setSelected(group.id)}
                className={`relative flex flex-row sm:flex-col items-center sm:items-start p-4 sm:p-6 rounded-2xl sm:rounded-3xl border text-left transition-all duration-300 w-full group ${
                  isSelected 
                    ? 'border-[#ccff00] bg-[#ccff00]/5 shadow-[0_0_30px_rgba(204,255,0,0.15)] ring-1 ring-[#ccff00]' 
                    : 'border-white/10 bg-[#0f1014] hover:border-white/30 hover:bg-white/5'
                }`}
              >
                {/* Selection Checkmark */}
                {isSelected && (
                  <div className="absolute top-1/2 -translate-y-1/2 right-4 sm:top-5 sm:-translate-y-0 sm:right-5 text-[#ccff00] animate-in zoom-in duration-200">
                    <CheckCircleIcon weight="fill" className="w-6 h-6 sm:w-7 sm:h-7" />
                  </div>
                )}
                
                {/* Icon */}
                <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 mr-4 sm:mr-0 sm:mb-6 transition-all duration-300 ${
                  isSelected ? 'bg-[#ccff00] text-black scale-110 shadow-[0_0_20px_rgba(204,255,0,0.4)]' :
                  group.color === 'green' ? 'bg-green-500/10 text-green-400 group-hover:scale-110' :
                  group.color === 'cyan' ? 'bg-[#00f0ff]/10 text-[#00f0ff] group-hover:scale-110' :
                  'bg-[#ff00a0]/10 text-[#ff00a0] group-hover:scale-110'
                }`}>
                  <Icon weight={isSelected ? "fill" : "duotone"} className="w-7 h-7 sm:w-8 sm:h-8" />
                </div>

                {/* Text Content */}
                <div className="flex-1 pr-8 sm:pr-0">
                  <div className="flex flex-row sm:flex-col items-baseline sm:items-start gap-2 sm:gap-0 mb-1 sm:mb-0">
                    <h3 className={`text-lg sm:text-xl font-bold transition-colors ${isSelected ? 'text-[#ccff00]' : 'text-white'}`}>
                      {group.title}
                    </h3>
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500 bg-white/5 px-2 py-0.5 rounded-md sm:mb-3">
                      Ages {group.ages}
                    </span>
                  </div>
                  <p className="text-[11px] sm:text-sm text-gray-400 leading-snug sm:leading-relaxed hidden sm:block">
                    {group.desc}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center text-sm w-full max-w-md animate-in slide-in-from-bottom-2">
            {error}
          </div>
        )}

        {/* Confirm Button */}
        <div className="w-full max-w-md">
          <button
            onClick={handleConfirm}
            disabled={!selected || loading}
            className={`flex items-center justify-center gap-3 w-full px-8 py-4 rounded-xl sm:rounded-2xl font-bold uppercase tracking-wider transition-all duration-300 ${
              selected 
                ? 'bg-[#ccff00] text-black hover:bg-white hover:scale-[1.02] shadow-[0_0_25px_rgba(204,255,0,0.3)]' 
                : 'bg-[#0f1014] text-gray-600 cursor-not-allowed border border-white/5'
            }`}
          >
            {loading ? (
              <span className="flex items-center gap-2 animate-pulse">
                Saving Profile...
              </span>
            ) : (
              <>
                Confirm & Continue
                <ArrowRightIcon weight="bold" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}