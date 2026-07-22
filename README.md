```
███╗   ███╗██╗   ██╗██████╗  █████╗ ██╗   ██╗███████╗
████╗ ████║╚██╗ ██╔╝██╔══██╗██╔══██╗╚██╗ ██╔╝██╔════╝
██╔████╔██║ ╚████╔╝ ██║  ██║███████║ ╚████╔╝ ███████╗
██║╚██╔╝██║  ╚██╔╝  ██║  ██║██╔══██║  ╚██╔╝  ╚════██║
██║ ╚═╝ ██║   ██║   ██████╔╝██║  ██║   ██║   ███████║
╚═╝     ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝
        » R  T R U E «  ·  a retro life-tracker
                  ~ ~ ~   day 1: water   ~ ~ ~
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

The app is organized around **time horizons** — every domain rolls up from a single day into week, month and year views, each with a **Progress** (what happened) and a **Plan** (what's coming) tab.

### Hydration & nutrition
- **Water** — one-tap quick-adds or a full manual form; an animated SVG bottle fills toward your daily goal with progress markers.
- **Meals** — breakfast / lunch / dinner with cooking metadata (cooked-by, restaurant, or meal box).
- **Snacks** — two daily slots.
- **Intake** — fruit, creatine, vitamins and protein shake checks.
- **Meal boxes** — a fridge stock counter for prepped portions.
- **Restaurants** — a yearly log of restaurant visits.

### Health & fitness
- **Gym** — session templates with warmups, planned across the week.
- **Cardio** — running, cycling and swimming sessions.
- **Sport** — configurable sport sessions.
- **Bathing / sauna** — bad & bastu sessions with water temperature, repeatable.
- **Weight** — morning / day / evening logs against a weekly plan.
- **Steps & activity hours** — daily activity trackers with goals.
- **Smoke-free** — nicotine & cannabis tri-state (both "yes" = fully smoke-free).
- **Sugar-free / light cleaning** — simple daily habits.

### Mind & lifestyle
- **Mood** — pick one of six emoji moods per day.
- **Mobile games** — Chess, Duolingo and Pokémon GO daily checks.
- **Media** — a yearly plan for books, series and movies with notes, ratings, credits and daily progress logs.
- **Live events** — concerts, sport, races, birthdays, weddings and more.
- **Gigs** — band gigs (Totes, Bojeng) with ratings.

### Tasks & finance
- **Weekly tasks** — recurring and one-off tasks with categories, checklists, music prep (gig/live), on-hold parking, and drag-to-day planning.
- **Monthly tasks** — bills (Räkningar), salary, savings, car pay, and a monthly finance-accounts snapshot (LF, ISK, crypto…).
- **Expenses (Utgifter)** — aggregated expense tracking derived from tasks.
- **Templates** — enable / disable recurring task templates per category in settings.

### Work & leave
- **Work** — start/end time logging on weekdays.
- **Leave periods** — vacations and days off render on a year calendar and automatically skip work logging.

### Journal & planning UX
- **Journal** — an auto-generated day narrative built from all your tracked activity, plus manual entries you can reorder and edit.
- **Day plan** — a unified drag-and-drop list merging tasks, training, media and habits into one ordered plan.
- **Week board** — a unified drag-and-drop week planner grouped by category and training.
- **Reschedule after 8pm** — overdue items can be pushed to another day late in the evening.
- **Customizable week layout** — arrange the sections/rows of your week progress board.

### Account
- Email/password **register / login**, **profile** (display name + daily water goal), and a **settings** hub for habits, categories, templates and layout.

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

Everything lives in Supabase Postgres with RLS. Migrations run in order (`0001` → `0063`) and are safe to re-run.

| Domain | Core tables |
|---|---|
| Auth & profile | `profiles` (water goal, week-progress layout) |
| Water | `water_logs` |
| Habits | `habits`, `habit_checks` |
| Meals & snacks | `meal_entries`, `snack_checks`, `meal_restaurants`, `meal_box_stock` |
| Intake | `intake_entries` |
| Daily trackers | `daily_activity_logs` (steps, activity hours) |
| Tasks | `task_categories`, `weekly_tasks`, `weekly_task_placements`, `monthly_tasks`, `monthly_task_completions`, `weekly_task_checklist_items`, `weekly_task_checklist_completions` |
| Finance | `monthly_finance_snapshots` (+ bills/salary/savings/car pay/expenses via tasks) |
| Training | `gym_*`, `cardio_*`, `sport_*`, `bathing_*` (session templates + week placements) |
| Weight | `weight_week_plans`, `weight_logs` |
| Reading & games | `reading_books`, `reading_daily_logs`, `mobile_game_daily_logs` |
| Media | `media_items`, `media_daily_logs` |
| Live events / gigs | `live_events`, `gigs` |
| Mood / smoke-free | `mood_daily_logs`, `smoke_free_daily_logs` |
| Journal | `journal_entries`, `journal_entry_orders`, `journal_entry_edits` |
| Work / leave | `work_daily_logs`, `leave_periods` |
| Planning order | `daily_plan_orders` |

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

Built for the retro-future, one habit at a time. 🧡
