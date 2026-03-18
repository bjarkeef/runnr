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
3. Build command: `npm run build`.
4. Add environment variables:

```env
DATABASE_URL=<database_url>
DIRECT_URL=<direct_url>
STRAVA_CLIENT_ID=<strava_client_id>
STRAVA_CLIENT_SECRET=<strava_client_secret>
STRAVA_REDIRECT_URI=https://your-domain.com/api/auth/callback
OPENROUTESERVICE_API_KEY=<optional>
```

## 5. Run Migrations

Run Prisma migrations against production DB:

```bash
npx prisma migrate deploy
```

Run this in CI/CD or as a release step.

## 6. Verify

- Open app and complete Strava login
- Trigger run sync and verify data appears
- Test stats and race prediction pages
- If route planner is enabled, test a generated route

## Security Notes

- Never commit secrets to git
- Keep all env values in Vercel/project secrets
- Rotate tokens/credentials if exposed
