# SabTa

<p align="center">
  <img src="./public/icons.svg" alt="SabTa logo" width="180" />
</p>

SabTa is a gamified quiz and knowledge arena built for learners of all ages. Players sign in, choose an age category, answer questions, build streaks, unlock rewards, climb leaderboards, and join a social learning experience with clans, profile tracking, and global chat.

This project is a React + TypeScript app powered by Vite, with Supabase for authentication and data, and Capacitor for Android packaging.

## Overview

SabTa combines education and competition in one experience:

- Quiz-based learning across multiple categories and difficulty levels
- Personalized onboarding by age group: kids, teens, and adults
- Progress tracking with quiz history, accuracy, points, and coins
- Rewards shop and cosmetic unlocks
- Leaderboard rankings and player profiles
- Clan features and social interactions
- Real-time community elements such as announcements and chat
- Android app packaging via Capacitor

## Key Features

### Quiz gameplay
- Choose from published quizzes tailored to the player age category
- Answer timed questions and earn points
- View an end-of-quiz summary with scoring and feedback
- Track performance over time through attempts and stats

### Player experience
- Google sign-in via Supabase auth
- Role validation to separate player and admin flows
- Profile setup and onboarding screen
- Age selection and dashboard navigation
- Quiz history, leaderboard access, and quick navigation

### Social and progression
- Global chat for community communication
- Player profiles and follow/friend-like activity
- Clans and battle interactions
- Rewards shop with unlockable items and progression-based incentives
- Seasonal updates and announcements

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Supabase
- Capacitor Android
- Tailwind CSS
- Phosphor Icons

## Project Structure

```text
.
├── android/                  # Android project generated for Capacitor
├── public/                  # Static assets
├── sql/                     # Database schema and SQL setup for Supabase
├── src/
│   ├── components/          # Shared UI pieces
│   ├── css/                 # Styling assets
│   ├── lib/                 # Supabase client setup and shared libs
│   ├── pages/               # App screens and gameplay flow
│   ├── App.tsx              # Routing and app bootstrap
│   ├── main.tsx             # Entry point
│   └── index.css            # Global styling
├── .env.example             # Optional example if you add one locally
├── app-build.txt            # Android build helper commands
├── capacitor.config.ts      # Capacitor configuration
├── eslint.config.js         # Lint configuration
├── index.html               # Vite entry page
├── package.json             # Scripts and dependencies
├── tsconfig*.json           # TypeScript config
├── vercel.json              # SPA rewrite config for Vercel
├── vite.config.ts           # Vite config
└── README.md
```

## Prerequisites

Before running the app, make sure you have:

- Node.js 18+
- npm
- A Supabase project
- Android Studio/SDK if you want to package the Android app

## Environment Variables

Create a `.env` file in the project root with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The app initializes Supabase in `src/lib/supabase.ts` using these variables.

## Installation

```bash
npm install
```

## Running the App Locally

```bash
npm run dev
```

This starts the Vite development server. The app is usually available at:

```text
http://localhost:5173
```

## Production Build

```bash
npm run build
```

## Android Package Build

This project is configured for Capacitor Android builds.

```bash
npx cap sync
cd android
./gradlew assembleDebug
```

You can also use the helper commands in `app-build.txt`.

## Database and Backend

The schema and game logic are defined in the Supabase SQL file:

- `sql/sabta.sql`

That SQL script includes tables for:

- user profiles
- quizzes and questions
- quiz attempts and responses
- seasons and rewards
- leaderboards and clan-related structures
- notifications and challenge flows

## Notes

- The app expects a Supabase-backed auth and profile model.
- Admin accounts are intentionally blocked from the player app flow.
- The app includes SPA routing handled by Vercel rewrite settings and browser router logic.

## Useful Commands

```bash
npm run dev      # local development
npm run build    # production build
npm run preview  # preview production build locally
npx cap sync     # sync Capacitor with native project
```

## Future Improvements

Potential enhancements for the project include:

- More quiz categories and difficulty tuning
- Expanded analytics dashboard for educators or admins
- Better moderation tools for chat and clan activity
- Multi-platform packaging beyond Android
- Performance optimization and offline support

## License

No explicit license file is included in this repository, so usage rights should be confirmed with the project owner before public distribution or commercial use.

