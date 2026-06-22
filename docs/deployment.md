# Deployment

Quick deploy guide for Vercel + PostgreSQL.

## 1. Prerequisites

- Vercel account
- PostgreSQL provider (Neon, Supabase, Railway, Render, or similar)
- Strava OAuth app
- Optional: OpenRouteService API key (route planner)

## 2. Create Production Database

Provision a PostgreSQL instance and collect:

- `DATABASE_URL` (pooled URL when available)
- `DIRECT_URL` (direct URL for Prisma migrations)

If your provider gives only one URL, use it for both.

## 3. Configure Strava OAuth

In your Strava app settings:

- Website: your production URL
- Authorization Callback Domain: your deployed domain (without protocol)

Set callback env value:

```env
STRAVA_REDIRECT_URI=https://your-domain.com/api/auth/callback
```

## 4. Deploy On Vercel

1. Import repository in Vercel.
2. Framework preset: Next.js.
3. Build command: `npm run build` (default — do not override unless you keep migration behavior).
4. Add environment variables:

```env
DATABASE_URL=<database_url>
DIRECT_URL=<direct_url>
STRAVA_CLIENT_ID=<strava_client_id>
STRAVA_CLIENT_SECRET=<strava_client_secret>
STRAVA_REDIRECT_URI=https://your-domain.com/api/auth/callback
OPENROUTESERVICE_API_KEY=<optional>
```

Both `DATABASE_URL` and `DIRECT_URL` are required on Vercel. Prisma uses `DIRECT_URL` for migrations (important for pooled providers like Neon/Supabase/Prisma Accelerate).

## 5. Migrations On Every Deploy

Migrations run **automatically** during `npm run build` when `VERCEL=1` (set by Vercel) or `CI=true`:

1. `prisma migrate deploy` — applies any pending SQL in `prisma/migrations/`
2. `prisma generate` — generates the Prisma client
3. `next build` — builds the Next.js app

If a migration fails, the **build fails** and the bad deploy is not shipped. That is intentional: schema and code stay in lockstep.

Local builds skip migrate by default. To force it locally:

```bash
RUN_DB_MIGRATE=1 npm run build
# or
npm run db:migrate
```

## 6. Verify

- Open app and complete Strava login
- Trigger run sync and verify data appears
- Test stats and race prediction pages
- If route planner is enabled, test a generated route

## Security Notes

- Never commit secrets to git
- Keep all env values in Vercel/project secrets
- Rotate tokens/credentials if exposed
