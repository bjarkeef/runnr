# App Overview

Runnr is a Next.js App Router project that syncs your Strava running data into PostgreSQL and renders training insights.

## Core User Flow

1. User logs in with Strava OAuth
2. Tokens are stored in database
3. Runs are synced into `Activity` records
4. Dashboard pages query API routes for stats and predictions
5. User can plan routes, track gear, and manage race goals

## Tech Summary

- Frontend: Next.js 15 + React 19 + TypeScript
- Styling/UI: Tailwind CSS + shadcn/ui
- Data: PostgreSQL + Prisma
- Integrations: Strava API, OpenRouteService API

## Key Folders

- `src/app`: pages and API route handlers (App Router)
- `src/components`: reusable UI and feature components
- `src/lib`: business logic, Prisma client, Strava helpers
- `prisma/schema.prisma`: database models and relations
- `prisma/migrations`: migration history

## Important API Routes

- `/api/auth/login`, `/api/auth/callback`, `/api/auth/logout`: Strava OAuth flow
- `/api/sync-runs`: syncs new Strava activities into database
- `/api/stats`: dashboard metrics and aggregates
- `/api/race-predictions`: predictions and pacing data
- `/api/route-planner`: map route generation via OpenRouteService
- `/api/gear`: cached gear and usage distance

## Data Models (High Level)

- `User`: Strava identity + token data
- `Activity`: synced run data from Strava
- `RaceGoal`: target race and training days
- `TrainingPlan` / `WeeklyPlan` / `Workout`: generated planning data
- `Gear`: shoes and other tracked gear

## Where To Start If You Are New

1. Read [getting-started.md](./getting-started.md)
2. Inspect `prisma/schema.prisma`
3. Follow auth flow in `src/app/api/auth/*`
4. Follow sync flow in `src/app/api/sync-runs/route.ts`
5. Explore UI pages in `src/app/*/page.tsx`
