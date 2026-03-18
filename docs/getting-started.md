# Getting Started

Run Runnr locally in about 10-15 minutes.

## Prerequisites

- Node.js 20+
- npm
- Strava account
- PostgreSQL database (local Docker, local install, or cloud)

## 1. Clone And Install

```bash
git clone https://github.com/bjarkeef/runnr.git
cd runnr
npm install
```

## 2. Create Local Environment File

```powershell
Copy-Item .env.example .env.local
```

```bash
cp .env.example .env.local
```

Open `.env.local` and set the required values:

- `DATABASE_URL`
- `DIRECT_URL`
- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REDIRECT_URI`

For database choices and connection string examples, see [database-setup.md](./database-setup.md).

Optional variables:

- `OPENROUTESERVICE_API_KEY` (required only for route generation)
- `NEXT_PUBLIC_ROUTE_PLANNER_LAT`
- `NEXT_PUBLIC_ROUTE_PLANNER_LNG`

## 3. Create Strava OAuth App

1. Log in at [Strava](https://www.strava.com/login)
2. Open API settings: [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
3. Create an app with these values:
  Application Name: `Runnr`
  Category: `Training`
  Website: `http://localhost:3000`
  Authorization Callback Domain: `localhost`
4. Copy Client ID and Client Secret into `.env.local`

For local development, keep:

```env
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/callback
```

## 4. Apply Database Migrations

```bash
npm run db:migrate
```

Alternative for rapid local schema iteration:

```bash
npm run db:push
```

## 5. Start The App

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## 6. First Sync

1. Click Connect with Strava
2. Approve permissions
3. Wait for initial sync (or trigger sync in Settings)
4. Check Stats page for historical runs

## Troubleshooting

- Prisma connection error: verify `DATABASE_URL` and `DIRECT_URL`, then confirm DB is reachable.
- OAuth callback mismatch: ensure `STRAVA_REDIRECT_URI` exactly matches your Strava app callback.
- Route planner unavailable: add `OPENROUTESERVICE_API_KEY`.
