# Needle

A live social music room platform inspired by Turntable.fm. Join rooms, take turns DJing, chat in real time, react to tracks, and build taste-based identity.

## Tech Stack

- **Next.js** (App Router) + TypeScript
- **Tailwind CSS** for styling
- **Supabase** for Auth, Postgres, and Realtime
- **YouTube IFrame API** for MVP playback
- **OpenAI API** for optional Needlebot AI host
- **Vercel** for deployment

## Getting Started

### 1. Clone and install

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_initial_schema.sql` via the SQL Editor
3. Run `supabase/seed.sql` to seed badges
4. Enable Realtime for: `chat_messages`, `room_members`, `room_playback`, `track_votes`, `dj_slots`, `dj_waitlist`, `queue_items`

### 3. Configure environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase URL, anon key, and service role key. Optionally add `OPENAI_API_KEY` for Needlebot.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Seed example rooms

1. Sign up for an account
2. On the home page, click **Seed Example Rooms** (or `PUT /api/rooms`)

## Pages

| Route | Description |
|-------|-------------|
| `/` | Room directory — active rooms as cards |
| `/rooms/[slug]` | Live listening room |
| `/rooms/create` | Create a new room |
| `/profile/[id]` | User profile with stats and saved tracks |
| `/auth/login` | Sign in |
| `/auth/signup` | Create account |

## Core Features

- **Live rooms** with shared YouTube playback synced via server timestamps
- **DJ booth** — up to 3 DJs rotate, each queues one YouTube track
- **Reactions** — Awesome / Lame / Save (lame threshold skips tracks)
- **Real-time chat** with system messages and Needlebot
- **Presence** — see who's in the room
- **Profiles** — stats, badges, saved tracks

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables from `.env.example`
4. Set `NEXT_PUBLIC_APP_URL` to your production URL

## Design

Dark, warm, late-night aesthetic. The room is the product — not a dashboard.

Colors: `#0F0E17` background, `#FF8906` accent, `#E53170` secondary.
