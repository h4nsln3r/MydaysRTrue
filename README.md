```
███╗   ███╗██╗   ██╗██████╗  █████╗ ██╗   ██╗███████╗
████╗ ████║╚██╗ ██╔╝██╔══██╗██╔══██╗╚██╗ ██╔╝██╔════╝
██╔████╔██║ ╚████╔╝ ██║  ██║███████║ ╚████╔╝ ███████╗
██║╚██╔╝██║  ╚██╔╝  ██║  ██║██╔══██║  ╚██╔╝  ╚════██║
██║ ╚═╝ ██║   ██║   ██████╔╝██║  ██║   ██║   ███████║
╚═╝     ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝
        » R  T R U E «  ·  a retro life-tracker
```

# MyDays R True

A retro-flavored **personal life tracker** that started with a single glass of water and grew into a full day / week / month / year planner. Log everything from hydration and workouts to bills, books, gigs and moods — then let the app spin your day into an auto-generated journal.

Built with **Next.js 16 (App Router) + TypeScript + Supabase**, styled with **SCSS modules** on a shared design-token layer, and tuned **mobile-first** with a sticky bottom nav.

---

## Table of contents

- [Stack](#stack)
- [Feature tour](#feature-tour)
- [Pages & routes](#pages--routes)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Data model](#data-model)
- [Design system](#design-system)
- [Setup](#setup)
- [Scripts](#scripts)
- [Conventions](#conventions)
- [Roadmap](#roadmap)

---

## Stack

- **Next.js 16** — App Router, React Server Components, Server Actions, middleware-based auth refresh
- **React 19** + **TypeScript** (strict)
- **Supabase** — Auth (email/password) + Postgres + Row Level Security
- **@dnd-kit** — drag-and-drop for the day and week planning boards
- **SCSS modules** with a shared token layer (`src/styles/abstracts`)
- **Google Fonts** via `next/font`: `Monoton` (display), `Bricolage Grotesque` (UI), `JetBrains Mono` (numbers)
- **Mobile-first** layout (max ~540px → expands to 1120px) with a sticky pill bottom nav
- **Locale** `sv-SE` for number/weight formatting, timezone `Europe/Stockholm`

---

## Feature tour

The app is organized around **time horizons** — everything rolls up from a single day into week, month and year views, each with a **Progress** tab (what happened) and a **Plan** tab (what's coming).

At a high level you can track:

- **Hydration & nutrition** — water, meals, snacks and daily intake.
- **Health & fitness** — training sessions, weight, activity and everyday habits.
- **Mind & lifestyle** — mood, media, games and live events.
- **Tasks & finance** — recurring and one-off tasks plus bills, savings and expenses.
- **Work & leave** — work hours and vacation/day-off periods.

On top of the tracking sits a **planning layer**: a drag-and-drop day and week planner, a customizable week layout, and an **auto-generated journal** that turns everything you logged into a readable day narrative. Accounts are email/password, with a profile and a settings hub for tuning habits, categories and templates.

---

## Pages & routes

Route groups `(app)` and `(auth)` don't appear in the URL.

### Authenticated — `(app)`

| Route | What |
|---|---|
| `/` | Today dashboard — day nav, Progress/Plan tabs, activities, habits, meals, training, journal, water summary |
| `/day/[date]` | Same dashboard for any specific `YYYY-MM-DD` (past or future) |
| `/week` | Week view — Progress recap or a unified drag-and-drop plan board (`?start=`, `?view=`) |
| `/month` | Month view — habits, finance, bills, media, live events, gigs (`?m=YYYY-MM`, `?view=`) |
| `/year` | Year view — leave calendar, media, live events, gigs, restaurants (`?y=YYYY`, `?view=`) |
| `/water` | Water detail — daily logs + hero for a date (`?date=`) |
| `/add-water` | Manual water entry form with recent logs |
| `/settings` | Settings hub — habits, categories, task/training templates, layout |
| `/profile` | Display name, daily water goal, sign out |
| `/profile/tasks` | Enable/disable recurring weekly & monthly task templates by category |
| `/profile/meal-boxes` | Manage remaining meal-box portions |

### Auth — `(auth)`

| Route | What |
|---|---|
| `/login` | Sign in with email/password (supports `?redirectTo=`) |
| `/register` | Create an account |

### API

| Route | What |
|---|---|
| `/auth/callback` | Supabase code exchange → session, then redirect |

---

## Architecture

- **Server-first.** Pages are React Server Components that fetch through server-only data modules and hand plain data to client components for interactivity.
- **Paired lib modules.** Each domain has a client-safe `foo.ts` (types, labels, pure helpers) and a server-only `foo.server.ts` (`import "server-only"`, Supabase queries/mutations).
- **Server Actions** handle all writes (logging, toggling, reordering, template edits).
- **Auth & gating.** `src/middleware.ts` → `updateSession()` refreshes the Supabase session on every request and redirects: unauthenticated users to `/login?redirectTo=…`, and logged-in users away from the auth pages. Public paths are `/login`, `/register`, `/auth/*`.
- **Row Level Security** ensures every user only ever reads/writes their own rows; a DB trigger auto-creates a `profiles` row on signup.

---

## Project layout

```
src/
  app/
    (auth)/              # login + register (minimal shell)
    (app)/               # authenticated shell: /, day, week, month, year,
                         #   water, add-water, settings, profile…
    auth/callback/       # Supabase code exchange
    layout.tsx           # fonts + global styles + metadata
  components/            # ~60 feature components (day cards, boards, nav, UI primitives)
  lib/
    supabase/            # browser / server / middleware clients + generated types
    *.ts / *.server.ts   # domain modules (water, tasks, gym, media, journal, …)
    date.ts format.ts    # shared utilities
  styles/
    abstracts/           # SCSS tokens + mixins (@use "abstracts")
    globals.scss
  middleware.ts          # session refresh + route gating
supabase/
  migrations/            # 0001 → 0063, idempotent SQL
```

---

## Data model

Everything lives in **Supabase Postgres** with **Row Level Security**, so every user only ever reads and writes their own rows. Each domain (water, habits, meals, tasks, training, media, journal, work/leave…) has its own set of tables, and most follow the same shape: a **definition/plan** table and a matching **daily log** table.

Schema changes are shipped as ordered, idempotent SQL migrations in `supabase/migrations/` — safe to re-run and applied in sequence.

---

## Design system

- **SCSS modules** per component + shared globals; no runtime CSS-in-JS.
- **Tokens** in `src/styles/abstracts/_variables.scss` — retro orange-on-black palette, cream text, water blue, plus spacing, radii, easings and breakpoints. Import with:

  ```scss
  @use "abstracts" as *;
  ```

- **Mixins** in `_mixins.scss` — focus ring, retro grain, sun stripes.
- **Globals** in `globals.scss` — dark gradient background, typography, `.app-shell`, mobile-first `.container`.
- **Theme** — `#0a0a0a` background, `#ff7a1a` orange accent; `Monoton` for display headings, `Bricolage Grotesque` for UI, `JetBrains Mono` for numbers.

Because everything reads from the token layer, re-theming is a one-file change.

---

## Setup

### 1. Install

```bash
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → new project.
2. Copy the **Project URL** and **anon public key** from `Project Settings → API`.
3. Optionally, under `Authentication → Providers → Email`, disable "Confirm email" for faster local testing.

### 3. Configure env vars

Copy `.env.example` to `.env.local` and fill it in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your anon key>
```

### 4. Run the migrations

In the Supabase **SQL editor**, run the files in `supabase/migrations/` in order (`0001_init.sql` first, up to the latest). They create every table, enable **Row Level Security**, and add a trigger that auto-creates a `profiles` row on signup. The scripts are idempotent — re-running is safe.

### 5. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000>. The middleware sends unauthenticated visitors to `/login`; create an account, log in, and you'll land on the dashboard.

---

## Scripts

```bash
npm run dev        # start the dev server
npm run build      # production build
npm run start      # serve the production build
npm run lint       # next lint
npm run typecheck  # tsc --noEmit
```

---

## Conventions

- **Never** import a `*.server.ts` module from a client component — keep the client/server split clean.
- All writes go through **Server Actions**; components refresh via `router.refresh()`.
- Dates are handled as local `YYYY-MM-DD` strings (see `lib/date.ts`) to avoid timezone drift.
- New migrations are additive and numbered sequentially.

---

## Roadmap

### User-customizable tasks

Today the recurring tasks come from a fixed set of templates that each user can only turn **on or off** per category. The goal is to let every user shape their own tasks around their own life, without touching code.

The idea, roughly:

- **User-owned task definitions.** A `task_definitions` table where each user creates their own tasks: title, category, an icon/color, and an optional checklist. The built-in templates become just default seeds — everything is editable and deletable from there.
- **Custom categories.** Let users add, rename, reorder and color their own categories, instead of the current fixed list.
- **Flexible recurrence.** Store a small recurrence rule per task (e.g. daily, every N days, specific weekdays, monthly on day X, or one-off). A lightweight "recurrence engine" then materializes the right task instances into each day / week / month view.
- **A task builder UI.** A dedicated screen in settings to create and edit these definitions, reusing the drag-and-drop planning the app already has.
- **Sharing (later).** Optionally let users publish a task or a whole category as a shareable template others can import.

This keeps the current structure intact — the planning, journal and progress views would simply read from user-defined tasks instead of hardcoded templates.

---

Built for the retro-future, one habit at a time. 🧡
