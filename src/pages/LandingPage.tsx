import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  ArrowRightIcon,
  BrainIcon,
  LightningIcon,
  TrophyIcon,
  ClockIcon,
  GameControllerIcon,
  CheckIcon,
  SparkleIcon,
  TargetIcon,
  MedalIcon,
  UsersIcon,
  LockKeyIcon,
  CaretRightIcon,
  PlantIcon,
  RocketIcon,
} from '@phosphor-icons/react'

import sabtaLogo from '../assets/icons/sabta-logo.png'
import sabtaEagle from '../assets/images/sabta-center.png' 
import '../css/LandingPage.css'

export default function LandingPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authError) {
        setError(authError.message)
        setLoading(false)
      }
    } catch {
      setError('Unable to connect right now. Please try again.')
      setLoading(false)
    }
  }

  const features = [
    { icon: BrainIcon, title: 'Train your brain', description: 'Explore science, math, history, and tech. There is always something new to discover.', color: 'lime' },
    { icon: LightningIcon, title: 'Earn every point', description: 'Answer correctly, beat the clock, and collect points for your next reward.', color: 'cyan' },
    { icon: TrophyIcon, title: 'Claim your place', description: 'Build your best scores, unlock achievements, and compete in your age group.', color: 'pink' },
  ]

  const steps = [
    { number: '01', icon: UsersIcon, title: 'Enter the arena', description: 'Sign in, set up your profile, and select your category.' },
    { number: '02', icon: TargetIcon, title: 'Take the challenge', description: 'Choose a subject. Think fast and beat the timer.' },
    { number: '03', icon: MedalIcon, title: 'Rise to the top', description: 'Earn points, collect achievements, and improve your rank.' },
  ]

  const ageGroups = [
    { icon: PlantIcon, title: 'Kids', ages: '6–12', color: 'green' },
    { icon: RocketIcon, title: 'Teens', ages: '13–17', color: 'cyan' },
    { icon: BrainIcon, title: 'Adults', ages: '18+', color: 'pink' },
  ]

  const answers = [
    { letter: 'A', answer: 'Venus' },
    { letter: 'B', answer: 'Mars', selected: true },
    { letter: 'C', answer: 'Jupiter' },
    { letter: 'D', answer: 'Mercury' },
  ]

  return (
    <main className="sabta-page" id="home">
      <div className="sabta-grid-bg" aria-hidden="true" />
      <div className="sabta-ambient sabta-ambient--cyan" aria-hidden="true" />
      <div className="sabta-ambient sabta-ambient--lime" aria-hidden="true" />

      <header className="sabta-header">
        <a href="#home" className="sabta-brand" aria-label="SabTa home">
          <span className="sabta-brand__logo">
            <img src={sabtaLogo} alt="SabTa logo" />
          </span>
          <span className="sabta-brand__words">
            <strong>SAB<span>TA</span></strong>
            <small>QUIZ ARENA</small>
          </span>
        </a>

        <nav className="sabta-nav" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-to-play">How to play</a>
          <a href="#about">Our mission</a>
        </nav>

        <button type="button" className="sabta-signin" onClick={handleGoogleLogin} disabled={loading}>
          <span className="sabta-google-g" aria-hidden="true">G</span>
          {loading ? 'Connecting...' : 'Sign in'}
        </button>
      </header>

      <section className="sabta-hero" aria-labelledby="sabta-hero-title">
        {/* Side Tabs */}
        <div className="sabta-side-tab sabta-side-tab--left" aria-hidden="true">
          <span className="sabta-side-chevron">»</span>
          <TrophyIcon weight="fill" />
          <span>FEATURED TOURNAMENTS</span>
        </div>
        <div className="sabta-side-tab sabta-side-tab--right" aria-hidden="true">
          <span className="sabta-side-chevron">«</span>
          <TrophyIcon weight="fill" />
          <span>GLOBAL RANKINGS LEADERBOARD</span>
        </div>

        <div className="sabta-hero-copy">
          <div className="sabta-eyebrow">
            <SparkleIcon weight="fill" />
            Knowledge is your superpower
          </div>

          <h1 id="sabta-hero-title">
            <span>THINK <em>BEYOND.</em></span>
            <span>ANSWER</span>
            <span className="sabta-lime">BOLDLY.</span>
            <span>RISE HIGHER.</span>
          </h1>

          <p className="sabta-hero-description">
            Welcome to SabTa. Challenge your knowledge, race against the clock,
            earn virtual rewards, and prove how far your mind can take you.
          </p>

          <div className="sabta-hero-actions">
            <button type="button" onClick={handleGoogleLogin} disabled={loading} className="sabta-button sabta-button--primary">
              <span>{loading ? 'Connecting...' : 'SabTa Arena Hub'}</span>
              <ArrowRightIcon weight="bold" />
            </button>
            <a href="#how-to-play" className="sabta-button sabta-button--secondary">
              Learn more <ArrowRightIcon weight="bold" />
            </a>
          </div>

          {error && (
            <div className="sabta-error" role="alert">
              <strong>Sign-in failed</strong>
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)}>Dismiss</button>
            </div>
          )}
        </div>

        <div className="sabta-mascot-stage" aria-label="SabTa eagle mascot">
          <img className="sabta-eagle" src={sabtaEagle} alt="SabTa eagle mascot" />
        </div>

        <aside className="sabta-quiz" aria-label="Quiz terminal preview">
          <div className="sabta-quiz__header">
            <div className="sabta-quiz__heading">
              <GameControllerIcon weight="fill" />
              <span>Quiz terminal</span>
            </div>
            <div className="sabta-window-dots" aria-hidden="true">
              <i /><i /><i />
            </div>
          </div>

          <div className="sabta-quiz-tabs">
            <div className="sabta-quiz-tab is-active">
              <GameControllerIcon weight="fill" />
              <span>General<br />discovery</span>
            </div>
            <div className="sabta-quiz-tab">
              <GlobeIconFallback />
              <span>Planet<br />discovery</span>
            </div>
          </div>

          <div className="sabta-quiz-progress-meta">
            <span>Q.04 / 10</span>
            <span className="sabta-timer"><ClockIcon weight="bold" /> 00:15</span>
          </div>
          <div className="sabta-progress-track">
            <span />
          </div>

          <div className="sabta-question">
            <p>General knowledge</p>
            <h2>Which planet is known as the Red Planet?</h2>
          </div>

          <div className="sabta-answers">
            {answers.map((option) => (
              <div key={option.letter} className={`sabta-answer${option.selected ? ' is-selected' : ''}`}>
                <span className="sabta-answer__letter">{option.letter}</span>
                <span className="sabta-answer__text">{option.answer}</span>
                {option.selected && <CheckIcon className="sabta-answer__check" weight="bold" />}
              </div>
            ))}
          </div>

          <div className="sabta-quiz-reward">
            <div>
              <small>Reward</small>
              <strong>+10 PTS</strong>
            </div>
            <span><LightningIcon weight="fill" /></span>
          </div>
        </aside>

        <div className="sabta-feature-strip" id="feature-strip">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <article className={`sabta-strip-item is-${feature.color}`} key={feature.title}>
                <Icon className="sabta-strip-icon" weight="duotone" />
                <div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              </article>
            )
          })}
          <div className="sabta-strip-markers" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </div>
        </div>
      </section>

      <section className="sabta-section" id="features">
        <div className="sabta-section-heading">
          <div>
            <p className="sabta-section-kicker">Built for curious minds</p>
            <h2>MORE THAN JUST A QUIZ.</h2>
          </div>
          <p className="sabta-section-intro">
            Every round is a chance to learn something new, challenge yourself, and make progress.
          </p>
        </div>
        <div className="sabta-feature-cards">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <article className={`sabta-feature-card is-${feature.color}`} key={feature.title}>
                <Icon weight="duotone" />
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <a href="#how-to-play">Explore <ArrowRightIcon /></a>
              </article>
            )
          })}
        </div>
      </section>

      <section className="sabta-section sabta-how" id="how-to-play">
        <div className="sabta-centered-heading">
          <p className="sabta-section-kicker is-pink">Three steps. One journey.</p>
          <h2>READY, SET, SABTA.</h2>
        </div>
        <div className="sabta-steps">
          {steps.map((step) => {
            const Icon = step.icon
            return (
              <article className="sabta-step" key={step.number}>
                <div className="sabta-step-icon">
                  <Icon weight="duotone" />
                  <span>{step.number}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="sabta-section sabta-age-section">
        <div className="sabta-age-panel">
          <div>
            <p className="sabta-section-kicker">A place for every player</p>
            <h2>YOUR AGE GROUP.<br />YOUR CHALLENGE.</h2>
            <p className="sabta-age-copy">
              SabTa is designed for different stages of learning, with age-appropriate content and separate rankings.
            </p>
          </div>
          <div className="sabta-age-groups">
            {ageGroups.map((group) => {
              const Icon = group.icon
              return (
                <article className={`sabta-age-card is-${group.color}`} key={group.title}>
                  <span><Icon weight="duotone" /></span>
                  <h3>{group.title}</h3>
                  <p>{group.ages}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="sabta-section sabta-mission" id="about">
        <div className="sabta-mission-panel">
          <TrophyIcon className="sabta-mission-trophy" weight="duotone" />
          <p className="sabta-section-kicker">Inspired by Odiongan, Romblon</p>
          <h2>EVERY ANSWER MATTERS.</h2>
          <p>
            SabTa brings learning, friendly competition, and gaming together.
            Think smart, play fair, and rise higher — one answer at a time.
          </p>
          <button type="button" onClick={handleGoogleLogin} disabled={loading} className="sabta-button sabta-button--white">
            {loading ? 'Connecting...' : 'Enter the Quiz Arena'}
            <ArrowRightIcon weight="bold" />
          </button>
          <div className="sabta-secure-note">
            <LockKeyIcon weight="fill" />
            Secure sign-in with Google
          </div>
          {error && <p className="sabta-mission-error" role="alert">{error}</p>}
        </div>
      </section>

      <footer className="sabta-footer">
        <a href="#home" className="sabta-footer-brand">
          <img src={sabtaLogo} alt="" />
          <strong>SAB<span>TA.</span></strong>
        </a>
        <p>© {new Date().getFullYear()} SabTa. Virtual points have no cash value.</p>
        <a href="#home" className="sabta-back-top">
          Back to top <CaretRightIcon weight="bold" />
        </a>
      </footer>

      <div className="sabta-system-bar" aria-hidden="true">
        <div><span>Selection</span><span>View</span><span>Go</span><span>Run</span><span>Terminal</span><span>Help</span></div>
        <div className="sabta-system-icons"><i /><i /><i /><b>08</b><i /><i /></div>
      </div>
    </main>
  )
}

function GlobeIconFallback() {
  return (
    <span className="sabta-planet-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8.5" />
        <ellipse cx="12" cy="12" rx="3.5" ry="8.5" />
        <path d="M4 9h16M4 15h16M3 20 21 4" />
      </svg>
    </span>
  )
}