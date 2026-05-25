# MyDays — track your days

A retro-flavored personal planner that starts with hydration and grows into a full life tracker. Built with **Next.js 16 (App Router) + TypeScript + Supabase**, styled with **SCSS modules**, and tuned for **mobile first**.

```
   ___   ___        _
  | _ ) | __|   _ _|_|_   ___
  | _ \ |__ \  |  _|   | / _ \
  |___/ |___/  |_| |_|_| \___/
        MyDays · day 1: water
```

## Stack

- **Next.js 16** App Router, server actions, middleware-based auth refresh
- **TypeScript** strict mode
- **Supabase** Auth + Postgres + Row Level Security
- **SCSS modules** with a shared design-token layer (`src/styles/abstracts`)
- **Google fonts**: `Monoton` (display), `Bricolage Grotesque` (UI), `JetBrains Mono` (numbers)
- **Mobile-first** layout with a sticky bottom nav

## Features so far

- **Auth** — email + password signup/login via Supabase, server actions, session-refreshing middleware.
- **Profile** — set display name + **daily water goal** (ml/day) with quick presets.
- **Quick log** — `/` dashboard one-tap quick adds, plus the `/add-water` URL for full-form logging with a note.
- **Daily illustration** — animated SVG bottle that fills as you drink, with goal markers and a daily “done?” status.
- **History** — today's log list with delete.
- **Retro design** — orange + black, grainy retro display font, mobile-tuned pill nav, soft glows.

## Pages

| Route | What |
|---|---|
| `/login` | Sign in with email/password |
| `/register` | Create an account |
| `/` | Daily hydration dashboard (bottle, status, quick add, history) |
| `/add-water` | Detailed water entry form + delete |
| `/profile` | Display name, daily water goal, sign out |
| `/auth/callback` | Supabase OAuth/email confirmation handler |

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → new project.
2. Copy the **Project URL** and **anon public key** from `Project Settings → API`.
3. Optionally, in `Authentication → Providers → Email`, disable “Confirm email” for fast local testing.

### 3. Configure env vars

Copy `.env.example` to `.env.local` and fill it in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
```

### 4. Run the schema

Open the Supabase **SQL editor** and paste the contents of `supabase/migrations/0001_init.sql`, then run. It will:

- Create `public.profiles` (one row per auth user, default 2500 ml/day).
- Create `public.water_logs` with a `local_date` column for clean daily totals.
- Enable **Row Level Security** so every user only ever sees their own data.
- Auto-create a `profiles` row whenever a new user signs up.

The script is idempotent — re-running is safe.

### 5. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. The middleware sends unauthenticated visitors to `/login`; from there click “Create an account”, log in, and you'll land on the dashboard.

## Project layout

```
src/
  app/
    (auth)/              # login + register (shared minimal layout)
    (app)/               # authenticated routes — dashboard, add-water, profile
    auth/callback/       # Supabase OAuth/email callback
    layout.tsx           # fonts + global styles
  components/
    Button/  Input/  Card/  BottomNav/  WaterBottle/
  lib/
    supabase/            # browser / server / middleware clients + types
    water.ts             # client-safe types, presets, formatters
    water.server.ts      # server-only daily summary query
    date.ts
  styles/
    abstracts/           # SCSS tokens + mixins (imported via @use "abstracts")
    globals.scss
  middleware.ts          # refreshes Supabase session + route gating
supabase/
  migrations/0001_init.sql
```

## Design tokens

All colors, spacing, radii, fonts, easings and breakpoints live in `src/styles/abstracts/_variables.scss`. The whole app pulls them via:

```scss
@use "abstracts" as *;
```

That makes it trivial to re-theme later — every page automatically picks up the change.

## What's next on the roadmap

The water tracker is module #1 of a wider day-planner. Next up (suggestions):

- **Streaks** — track consecutive days where the goal was met.
- **Notifications** — gentle nudges every few hours via Web Push.
- **Sleep + steps** — additional trackers using the same `profiles` + `*_logs` pattern.
- **Daily plan** — habits and reminders for the whole day.
- **Weekly view** — calendar-style grid of completed days.

## Useful scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
```

---

Built for the retro-future, one habit at a time.
