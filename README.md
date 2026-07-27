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
4. Run remaining migrations in order via the SQL Editor:
   - `002_room_energy.sql`
   - `003_user_avatar_color.sql`
   - `004_users_insert_policy.sql`
   - `005_friendships.sql`
   - `006_stress_test.sql` (stress harness)
   - `007_stress_bot_write_guard.sql` (stress harness)
5. Enable Realtime for: `chat_messages`, `room_members`, `room_playback`, `track_votes`, `dj_slots`, `dj_waitlist`, `queue_items`, `relationships`, `room_invites`

### 3. YouTube Data API (track search)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **YouTube Data API v3**
3. Create an API key (restrict to YouTube Data API v3 if desired)
4. Add to `.env.local`:

```
YOUTUBE_API_KEY=your-api-key
```

Search is optional — without a key, DJs can still paste YouTube links.

### 4. Configure environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Supabase URL, anon key, and service role key. Optionally add `OPENAI_API_KEY` for Needlebot.

For the production stress harness (optional), also set `STRESS_TEST_SECRET` and `CRON_SECRET` — see [Stress harness](#stress-harness) below.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Seed example rooms

1. Sign up for an account
2. On the home page, click **Seed Example Rooms** (or `PUT /api/rooms`)

## Pages

| Route | Description |
|-------|-------------|
| `/` | Room directory — active rooms as cards |
| `/rooms/[slug]` | Live listening room |
| `/rooms/create` | Create a new room |
| `/profile/[id]` | User profile with stats and saved tracks |
| `/friends` | Friends list, requests, and user search |
| `/admin/stress` | Secret-gated listener stress harness (not linked in nav) |
| `/auth/login` | Sign in |
| `/auth/signup` | Create account |

## Core Features

- **Live rooms** with shared YouTube playback synced via server timestamps
- **DJ booth** — up to 3 DJs rotate, each queues one YouTube track
- **Reactions** — Awesome / Lame / Save (lame threshold skips tracks)
- **Real-time chat** with system messages and Needlebot
- **Presence** — see who's in the room
- **Profiles** — stats, badges, saved tracks
- **Friends** — send and accept requests, search users, invite friends to rooms

## Stress harness

Optional, secret-gated tool to inject fake **listener-only** users into 1–3 live rooms so you can watch crowd UI and presence/Realtime load. Not linked from the main nav.

**Design / plan:** `docs/superpowers/specs/2026-07-26-production-stress-listeners-design.md`, `docs/superpowers/plans/2026-07-26-production-stress-listeners.md`

### Setup

1. Apply migrations `006_stress_test.sql` and `007_stress_bot_write_guard.sql` in the Supabase SQL Editor (order matters).
2. Generate secrets (keep them different):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

3. Add to `.env.local` (and Vercel for production):

```
STRESS_TEST_SECRET=...   # unlock UI + Authorization: Bearer for API
CRON_SECRET=...          # required on Vercel so scheduled ticks authenticate
```

4. Restart the app (`npm run dev` or redeploy). If `STRESS_TEST_SECRET` is unset, stress routes return 404.

### Caps and behavior

| Rule | Value |
|------|--------|
| Max listeners | 250 total per run |
| Max rooms | 1 primary + up to 2 secondary |
| Distribution | ~80% primary / remainder on secondaries |
| Default / max TTL | 20 / 30 minutes (auto-stop removes memberships) |
| Mode (v1) | `presence` only (DB members + cron heartbeats) |
| Side effects | Silent — no join chat, energy, Needlebot, or first-join stats |
| Bot identities | Reusable pool; fun display names; tagged `is_stress_bot` |

Stop from the UI or `DELETE /api/admin/stress`. Bot Auth accounts stay pooled; only `room_members` rows are removed.

### How to run a test

1. Note a room slug from `/rooms/<slug>`.
2. Open [http://localhost:3000/admin/stress](http://localhost:3000/admin/stress) and unlock with `STRESS_TEST_SECRET`.
3. Start with a small N (e.g. **10** listeners, short TTL).
4. Open the room as a real user — crowd / listener count should rise with **no** join chat spam.
5. **Stop** — bots leave the room. Or wait for TTL and hit the tick endpoint / wait for Vercel Cron.

API equivalents:

```bash
# Status
curl -H "Authorization: Bearer $STRESS_TEST_SECRET" http://localhost:3000/api/admin/stress

# Start
curl -X POST -H "Authorization: Bearer $STRESS_TEST_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"primaryRoomSlug":"your-slug","totalListeners":10,"ttlMinutes":5}' \
  http://localhost:3000/api/admin/stress

# Stop
curl -X DELETE -H "Authorization: Bearer $STRESS_TEST_SECRET" \
  http://localhost:3000/api/admin/stress

# Heartbeat / TTL (local stand-in for Vercel Cron)
curl -X POST -H "Authorization: Bearer $STRESS_TEST_SECRET" \
  http://localhost:3000/api/admin/stress/tick
```

On Vercel, `vercel.json` schedules `/api/admin/stress/tick` every minute. Production cron auth uses `CRON_SECRET` (`Authorization: Bearer <CRON_SECRET>`).

## Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables from `.env.example` (include `STRESS_TEST_SECRET` and `CRON_SECRET` if you want the stress harness)
4. Set `NEXT_PUBLIC_APP_URL` to your production URL
5. Ensure stress migrations `006` and `007` are applied on the production Supabase project

## Design

Warm late-night venue aesthetic — the room is the product, not a dashboard.

- **Fonts:** Bricolage Grotesque (display) + Hanken Grotesk (body)
- **Palette:** amber glow (`#ff9d3c`), warm browns (`#1c120b`), violet accent (`#7b5cff`)
- **Avatars:** vinyl blob characters with idle, dance, react, DJ, and "you" variants
- **Room energy:** server-synced 0–100 meter driven by votes, chat, reactions, and deck activity

Run migration `supabase/migrations/002_room_energy.sql` and enable Realtime on `rooms` for live energy sync.
