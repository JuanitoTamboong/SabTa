import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  ArrowRightIcon,
  PlayCircleIcon,
  BrainIcon,
  LightningIcon,
  TrophyIcon,
  GlobeHemisphereWestIcon,
  CheckCircleIcon,
  ClockIcon,
  GameControllerIcon,
  CheckIcon,
  SparkleIcon,
  StarIcon,
  TargetIcon,
  ShieldCheckIcon,
  MedalIcon,
  UsersIcon,
  LockKeyIcon,
  CaretRightIcon,
  PlantIcon,
  RocketIcon,
} from '@phosphor-icons/react'

// FIXED: Clean import path without hidden characters
import sabtaLogo from '../assets/icons/sabta-logo.png'

export default function LandingPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) {
        setError(error.message)
        setLoading(false)
      }
    } catch {
      setError('Unable to connect right now. Please try again.')
      setLoading(false)
    }
  }

  const features = [
    { icon: BrainIcon, title: 'Train your brain', description: 'Explore science, math, history, and tech. There is always something new to discover.', color: 'text-[#CCFF00]' },
    { icon: LightningIcon, title: 'Earn every point', description: 'Answer correctly, beat the clock, and collect points for your next reward.', color: 'text-[#00F0FF]' },
    { icon: TrophyIcon, title: 'Claim your place', description: 'Build your best scores, unlock achievements, and compete in your age group.', color: 'text-[#FF00A0]' },
  ]

  const steps = [
    { number: '01', icon: UsersIcon, title: 'Enter the arena', description: 'Sign in, set up your profile, and select your category.' },
    { number: '02', icon: TargetIcon, title: 'Take the challenge', description: 'Choose a subject. Think fast and beat the timer.' },
    { number: '03', icon: MedalIcon, title: 'Rise to the top', description: 'Earn points, collect achievements, and improve your rank.' },
  ]

  return (
    <>
      {/* 
        Adding custom CSS for the unique styling. 
        In a real app, move this to your global index.css or tailwind config.
      */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&display=swap');
        
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        
        .bg-dot-matrix {
          background-image: radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px);
          background-size: 24px 24px;
        }

        .neon-shadow-lime {
          box-shadow: 0 0 20px rgba(204, 255, 0, 0.2);
        }
        
        .neon-shadow-cyan {
          box-shadow: 0 0 20px rgba(0, 240, 255, 0.15);
        }

        .clip-brutal {
          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%);
        }
      `}</style>

      <main className="font-space relative min-h-screen overflow-hidden bg-[#0A0A0A] text-white selection:bg-[#CCFF00] selection:text-black">
        
        {/* Background Dot Matrix */}
        <div className="pointer-events-none absolute inset-0 bg-dot-matrix opacity-40" />
        <div className="pointer-events-none absolute top-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-[#CCFF00]/5 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-[-10%] right-[-10%] h-[600px] w-[600px] rounded-full bg-[#00F0FF]/5 blur-[120px]" />

        {/* Navigation */}
        <header className="relative z-20 border-b border-white/10 bg-[#0A0A0A]/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
            <a href="#home" className="flex items-center gap-3 group">
              {/* Increased container and image sizes here */}
              <div className="relative flex h-12 w-12 items-center justify-center bg-white/5 border border-white/10 transition group-hover:border-[#CCFF00]/50">
                <img src={sabtaLogo} alt="SabTa logo" className="h-9 w-9 object-contain transition-transform group-hover:scale-105" />
              </div>
              <div>
                <span className="block text-xl font-bold tracking-tighter">
                  SAB<span className="text-[#CCFF00]">TA</span>
                </span>
                <span className="block text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-400">Quiz Arena</span>
              </div>
            </a>

            <nav className="hidden items-center gap-8 text-xs font-bold uppercase tracking-wider text-gray-400 md:flex">
              <a href="#features" className="transition hover:text-[#CCFF00]">Features</a>
              <a href="#how-to-play" className="transition hover:text-[#CCFF00]">How to play</a>
              <a href="#about" className="transition hover:text-[#CCFF00]">Our mission</a>
            </nav>

            <button 
              onClick={handleGoogleLogin} 
              disabled={loading} 
              className="group relative overflow-hidden bg-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-black transition-all hover:bg-[#CCFF00] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="relative z-10">{loading ? 'Connecting...' : 'Sign In'}</span>
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section id="home" className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 lg:grid-cols-2 lg:gap-12 lg:px-12 lg:pb-32 lg:pt-24">
          
          <div className="relative">
            <div className="mb-6 inline-flex items-center gap-2 border border-[#CCFF00]/30 bg-[#CCFF00]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#CCFF00]">
              <SparkleIcon weight="fill" className="h-3.5 w-3.5" />
              Knowledge is your superpower
            </div>

            <h1 className="max-w-2xl text-5xl font-bold leading-[1.05] tracking-tighter sm:text-6xl lg:text-[80px]">
              THINK <span className="text-transparent" style={{ WebkitTextStroke: '1.5px #CCFF00' }}>BEYOND.</span><br />
              ANSWER <span className="text-[#CCFF00]">BOLDLY.</span><br />
              RISE HIGHER.
            </h1>

            <p className="mt-8 max-w-md text-sm leading-relaxed text-gray-400 sm:text-base">
              Welcome to SabTa. Challenge your knowledge, race against the clock, earn virtual rewards, and prove how far your mind can take you.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <button 
                onClick={handleGoogleLogin} 
                disabled={loading} 
                className="group flex min-h-[56px] items-center justify-center gap-3 bg-[#CCFF00] px-8 py-4 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-white neon-shadow-lime disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <span className="animate-pulse">Connecting...</span> : (
                  <>
                    <PlayCircleIcon weight="fill" className="h-5 w-5" />
                    Play for free
                    <ArrowRightIcon weight="bold" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              <a href="#how-to-play" className="flex min-h-[56px] items-center justify-center gap-2 border border-white/20 bg-transparent px-8 py-4 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-white/5">
                Discover SabTa
              </a>
            </div>

            {error && (
              <div role="alert" className="mt-6 border border-red-500/50 bg-red-500/10 p-4 text-xs text-red-400">
                <p className="font-bold uppercase">Sign-in failed</p>
                <p className="mt-1">{error}</p>
                <button onClick={() => setError(null)} className="mt-2 underline underline-offset-4 hover:text-white">Dismiss</button>
              </div>
            )}

            <div className="mt-12 flex flex-wrap gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <span className="flex items-center gap-1.5"><CheckCircleIcon weight="fill" className="h-4 w-4 text-[#CCFF00]" /> Free to play</span>
              <span className="flex items-center gap-1.5"><ShieldCheckIcon weight="fill" className="h-4 w-4 text-[#00F0FF]" /> Fair competition</span>
              <span className="flex items-center gap-1.5"><StarIcon weight="fill" className="h-4 w-4 text-[#FF00A0]" /> Virtual rewards</span>
            </div>
          </div>

          {/* Featured Quiz Card - Redesigned as a "Arcade Terminal" */}
          <div className="relative mx-auto w-full max-w-[480px] lg:ml-auto">
            <div className="absolute inset-0 translate-x-3 translate-y-3 bg-[#00F0FF] opacity-20 blur-xl"></div>
            
            <div className="relative border border-white/20 bg-[#111111] p-1">
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
                <div className="flex items-center gap-2">
                  <GameControllerIcon weight="fill" className="h-5 w-5 text-[#CCFF00]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-white">Quiz Terminal</span>
                </div>
                <div className="flex gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                </div>
              </div>

              <div className="p-5 sm:p-7">
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  <span>Q.04 / 10</span>
                  <span className="flex items-center gap-1 text-[#00F0FF]"><ClockIcon weight="bold" className="h-4 w-4" /> 00:15</span>
                </div>
                
                {/* Brutalist Progress Bar */}
                <div className="mt-3 flex h-3 w-full gap-1">
                  <div className="h-full w-[40%] bg-[#CCFF00]"></div>
                  <div className="h-full w-[10%] bg-[#CCFF00] opacity-50"></div>
                  <div className="h-full w-full bg-white/10"></div>
                </div>

                <div className="mt-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF00A0]">General Knowledge</p>
                  <h2 className="mt-2 text-2xl font-bold leading-tight text-white">Which planet is known as the Red Planet?</h2>
                </div>

                <div className="mt-6 space-y-2.5">
                  {[
                    { letter: 'A', answer: 'Venus' },
                    { letter: 'B', answer: 'Mars', selected: true },
                    { letter: 'C', answer: 'Jupiter' },
                    { letter: 'D', answer: 'Mercury' },
                  ].map((option) => (
                    <div 
                      key={option.letter} 
                      className={`flex items-center justify-between border p-3 transition ${
                        option.selected 
                          ? 'border-[#CCFF00] bg-[#CCFF00]/10' 
                          : 'border-white/10 bg-transparent hover:border-white/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`flex h-7 w-7 items-center justify-center text-xs font-bold ${
                          option.selected ? 'bg-[#CCFF00] text-black' : 'bg-white/10 text-gray-400'
                        }`}>{option.letter}</span>
                        <span className={`text-sm font-semibold ${option.selected ? 'text-white' : 'text-gray-400'}`}>{option.answer}</span>
                      </div>
                      {option.selected && <CheckIcon weight="bold" className="h-5 w-5 text-[#CCFF00]" />}
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Reward</p>
                    <p className="mt-1 text-sm font-bold text-[#CCFF00]">+10 PTS</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center border border-[#CCFF00]/30 bg-[#CCFF00]/10">
                    <LightningIcon weight="fill" className="h-4 w-4 text-[#CCFF00]" />
                  </div>
                </div>
              </div>
            </div>
            
            {/* Decorative Floating Elements */}
            <div className="absolute -right-4 -top-4 hidden border border-white/20 bg-[#111] p-3 sm:block">
               <TrophyIcon weight="fill" className="h-6 w-6 text-[#FF00A0]" />
            </div>
          </div>
        </section>

        {/* Feature Section - Grid layout */}
        <section id="features" className="relative z-10 border-y border-white/10 bg-[#0A0A0A]">
          <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
              <div className="max-w-xl">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#00F0FF]">Built for curious minds</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tighter sm:text-5xl">MORE THAN JUST A QUIZ.</h2>
              </div>
              <p className="max-w-xs text-sm text-gray-400 leading-relaxed">
                Every round is a chance to learn something new, challenge yourself, and make progress.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <article key={feature.title} className="group relative border border-white/10 bg-white/[0.02] p-8 transition duration-300 hover:bg-white/[0.04]">
                    <div className="absolute top-0 left-0 h-[2px] w-0 bg-[#CCFF00] transition-all duration-300 group-hover:w-full"></div>
                    <Icon weight="duotone" className={`h-10 w-10 ${feature.color}`} />
                    <h3 className="mt-8 text-xl font-bold">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-gray-400">{feature.description}</p>
                    <div className="mt-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/50 transition group-hover:text-white">
                      Explore <ArrowRightIcon className="h-3 w-3" />
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        {/* How to play - Stepped Timeline */}
        <section id="how-to-play" className="relative z-10 mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#FF00A0]">Three steps. One journey.</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tighter sm:text-5xl">READY, SET, SABTA.</h2>
          </div>

          <div className="relative mt-20 grid gap-10 md:grid-cols-3">
            {/* Connecting Line */}
            <div className="absolute left-[15%] right-[15%] top-8 hidden border-t border-dashed border-white/20 md:block" />
            
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <article key={step.number} className="relative flex flex-col items-center text-center">
                  <div className="relative z-10 flex h-16 w-16 items-center justify-center border border-white/20 bg-[#0A0A0A]">
                    <Icon weight="duotone" className="h-8 w-8 text-[#00F0FF]" />
                    <div className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center bg-[#00F0FF] text-xs font-bold text-black">
                      {step.number}
                    </div>
                  </div>
                  <h3 className="mt-6 text-lg font-bold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-400 max-w-[250px]">{step.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        {/* Age categories - Bold Banner */}
        <section className="relative z-10 px-5 pb-24 sm:px-8 lg:px-12">
          <div className="mx-auto max-w-7xl border border-white/10 bg-[#111111] p-8 sm:p-12 clip-brutal">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#CCFF00]">A place for every player</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">YOUR AGE GROUP.<br/>YOUR CHALLENGE.</h2>
                <p className="mt-4 text-sm leading-relaxed text-gray-400">
                  SabTa is designed for different stages of learning, with age-appropriate content and separate rankings.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { icon: PlantIcon, title: 'Kids', ages: '6–12', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
                  { icon: RocketIcon, title: 'Teens', ages: '13–17', color: 'text-[#00F0FF]', border: 'border-[#00F0FF]/30', bg: 'bg-[#00F0FF]/10' },
                  { icon: BrainIcon, title: 'Adults', ages: '18+', color: 'text-[#FF00A0]', border: 'border-[#FF00A0]/30', bg: 'bg-[#FF00A0]/10' },
                ].map((group) => {
                  const Icon = group.icon;
                  return (
                    <div key={group.title} className={`border ${group.border} bg-white/[0.02] p-6 flex flex-col items-center text-center transition hover:bg-white/[0.05]`}>
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${group.bg}`}>
                        <Icon weight="duotone" className={`h-7 w-7 ${group.color}`} />
                      </div>
                      <h3 className="mt-4 text-sm font-bold uppercase tracking-wider">{group.title}</h3>
                      <p className="mt-1 text-xs text-gray-500">{group.ages}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Mission & CTA */}
        <section id="about" className="relative z-10 px-5 pb-24 sm:px-8 lg:px-12">
          <div className="relative mx-auto max-w-5xl overflow-hidden border border-[#CCFF00]/30 bg-[#0A0A0A] px-6 py-16 text-center sm:px-12 sm:py-24 neon-shadow-lime">
            <div className="pointer-events-none absolute inset-0 bg-dot-matrix opacity-20" />
            <div className="relative">
              <TrophyIcon weight="duotone" className="mx-auto h-12 w-12 text-[#CCFF00]" />
              <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.3em] text-gray-400">Inspired by Odiongan, Romblon</p>
              <h2 className="mt-4 text-4xl font-bold tracking-tighter sm:text-6xl">EVERY ANSWER MATTERS.</h2>
              <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-gray-400">
                SabTa brings learning, friendly competition, and gaming together. Think smart, play fair, and rise higher — one answer at a time.
              </p>
              
              <button 
                onClick={handleGoogleLogin} 
                disabled={loading} 
                className="group relative mt-10 inline-flex min-h-[56px] items-center justify-center gap-3 bg-white px-8 py-4 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-[#CCFF00] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Connecting...' : 'Enter the Quiz Arena'}
                {!loading && <ArrowRightIcon weight="bold" className="h-4 w-4 transition-transform group-hover:translate-x-1" />}
              </button>
              
              <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <LockKeyIcon weight="fill" className="h-3.5 w-3.5" />
                Secure sign-in with Google
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="relative z-10 border-t border-white/10 bg-[#050505]">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 py-8 sm:px-8 md:flex-row lg:px-12">
            <a href="#home" className="flex items-center gap-3 group">
              {/* Increased footer logo size from h-6 to h-8 */}
              <img src={sabtaLogo} alt="" className="h-8 w-8 object-contain grayscale opacity-70 transition group-hover:grayscale-0 group-hover:opacity-100" />
              <span className="text-sm font-bold tracking-tighter text-gray-300">
                SAB<span className="text-[#CCFF00]">TA.</span>
              </span>
            </a>
            <p className="text-center text-[10px] uppercase tracking-wider text-gray-600">
              © {new Date().getFullYear()} SabTa. Virtual points have no cash value.
            </p>
            <a href="#home" className="group flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400 transition hover:text-white">
              Back to top
              <CaretRightIcon weight="bold" className="h-3 w-3 -rotate-90 transition-transform group-hover:-translate-y-1" />
            </a>
          </div>
        </footer>
      </main>
    </>
  )
}