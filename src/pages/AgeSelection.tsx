import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { PlantIcon, RocketIcon, BrainIcon, CheckCircleIcon, ArrowRightIcon } from '@phosphor-icons/react'

export default function AgeSelection() {
  const navigate = useNavigate()
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
    console.log("Attempting to save age category:", selected)

    try {
      // 1. Get the current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw new Error('No user found. Please log in again.')

      // 2. Update the profile with the selected age category
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ age_category: selected })
        .eq('id', user.id)

      if (updateError) throw updateError

      console.log("Successfully saved age category!")
      
      // 3. Redirect to dashboard
      // Using window.location.href forces a full reload so App.tsx grabs the new profile data
      window.location.href = '/dashboard' 
      
    } catch (err: any) {
      console.error("Error saving age:", err)
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
      
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#00f0ff]/10 blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#ccff00]/10 blur-[100px]" />

      <div className="relative z-10 max-w-5xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Select Your Age Group</h1>
          <p className="text-gray-400 text-lg">This helps us customize your quiz difficulty and leaderboards.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {ageGroups.map((group) => {
            const Icon = group.icon
            const isSelected = selected === group.id

            return (
              <button
                key={group.id}
                onClick={() => {
                  console.log("Selected:", group.id)
                  setSelected(group.id)
                }}
                className={`relative p-8 rounded-3xl border text-left transition-all duration-300 ${
                  isSelected 
                    ? 'border-[#ccff00] bg-[#ccff00]/10 shadow-[0_0_30px_rgba(204,255,0,0.2)] scale-[1.02]' 
                    : 'border-white/10 bg-[#0f1014] hover:border-white/30 hover:bg-white/5'
                }`}
              >
                {isSelected && (
                  <div className="absolute top-6 right-6 text-[#ccff00]">
                    <CheckCircleIcon weight="fill" className="w-8 h-8" />
                  </div>
                )}
                
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-colors ${
                  isSelected ? 'bg-[#ccff00] text-black' :
                  group.color === 'green' ? 'bg-green-500/10 text-green-400' :
                  group.color === 'cyan' ? 'bg-[#00f0ff]/10 text-[#00f0ff]' :
                  'bg-[#ff00a0]/10 text-[#ff00a0]'
                }`}>
                  <Icon weight={isSelected ? "fill" : "duotone"} className="w-8 h-8" />
                </div>

                <h3 className="text-2xl font-bold mb-1">{group.title}</h3>
                <p className="text-sm font-semibold text-gray-500 mb-4">Ages {group.ages}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{group.desc}</p>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-center text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleConfirm}
            disabled={!selected || loading}
            className={`flex items-center gap-3 px-12 py-4 rounded-2xl font-bold uppercase tracking-wider transition-all duration-300 ${
              selected 
                ? 'bg-[#ccff00] text-black hover:bg-white shadow-[0_0_20px_rgba(204,255,0,0.3)]' 
                : 'bg-[#0f1014] text-gray-600 cursor-not-allowed border border-white/5'
            }`}
          >
            {loading ? 'Saving...' : 'Confirm & Continue'}
            {!loading && <ArrowRightIcon weight="bold" />}
          </button>
        </div>
      </div>
    </div>
  )
}