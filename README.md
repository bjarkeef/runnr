# 🏃‍♂️ Runnr — Simple running dashboard

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Next.js](https://img.shields.io/badge/Next.js-15-informational?logo=nextdotjs)](https://nextjs.org/) [![TypeScript](https://img.shields.io/badge/TypeScript-%233178C6.svg?logo=typescript)]

Runnr is a lightweight, PWA-capable running dashboard built with Next.js + TypeScript. It syncs with Strava to visualize routes, track gear and personal records, and provides race predictions, pacing strategies, and training plans.

<p align="center">
  <img src="./public/dashboard-rounded.svg" alt="Runnr Dashboard" width="900">
</p>

## Quick highlights

### 📊 Comprehensive Stats & Insights
- **Weekly Streaks**: Track your consistency with week-by-week progress.
- **Personal Records**: Automatically detects and tracks your PRs across common distances (1k to Marathon).
- **Kudos Analytics**: Monitor your social engagement and community support.
- **Gear Tracking**: Keep an eye on your shoe distance (km) and health.
- **Animated Charts**: Visualize your monthly distance and training distribution.

### 🎯 Race Predictions & Strategy
- **Race Predictions**: Get realistic race time estimates based on your actual training volume and intensity.
- **Pacing Strategies**: Generate even, negative, or positive split strategies for your next race.
- **Global Performance**: Compare your times against global and regional runner averages to see where you stand.
- **Training Plans**: Customized training insights based on your performance data.

### 🗺️ Route Planner (WIP)
- **Custom Route Generation**: Plan running routes on the map with your target distance.
- **Interactive Mapping**: Click to set start locations and generate round-trip routes.
- **Route Statistics**: Get distance, duration, and elevation data for planned routes.

### 📈 Visual Analytics
- **Activity Heatmap**: Visualize all your running routes on an interactive map.
- **Today's Summary**: A quick snapshot of your latest run, weekly progress, and upcoming goals right on the dashboard.

## 🛠️ Tech Stack

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **UI & Styling**: [Tailwind CSS](https://tailwindcss.com/), [Shadcn UI](https://ui.shadcn.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **PWA**: Service Worker + Web App Manifest (offline / installable)
- **External APIs**: [Strava API v3](https://developers.strava.com/), [OpenRouteService](https://openrouteservice.org/)
- **State Management**: React Context
- **Date Utilities**: [date-fns](https://date-fns.org/)
- **Runtime**: Node.js 20.x

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- A Strava account (for API credentials)
- A PostgreSQL database (local or cloud-hosted)

### Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/bjarkeef/runnr.git
   cd runnr
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   bun install
   ```

3. **Configure Strava API:**
   - Log in to [Strava](https://www.strava.com/login)
   - Go to [Strava API Settings](https://www.strava.com/settings/api)
   - Create a new application with these details:
     - **Application Name**: `Runnr` (or your preferred name)
     - **Category**: `Training`
     - **Website**: `http://localhost:3000`
     - **Authorization Callback Domain**: `localhost`
   - Copy your **Client ID** and **Client Secret**

4. **Environment Setup:**
   Create a `.env.local` file in the root directory:
   ```env
   # Database
   DATABASE_URL="postgresql://user:password@host:port/dbname"
   DIRECT_URL="postgresql://user:password@host:port/dbname"

   # Strava OAuth
   STRAVA_CLIENT_ID="your_client_id"
   STRAVA_CLIENT_SECRET="your_client_secret"
   STRAVA_REDIRECT_URI="http://localhost:3000/api/auth/callback"

   # Route Planning
   OPENROUTESERVICE_API_KEY="your_openrouteservice_key"
   ```
   
   **⚠️ Do NOT commit `.env.local` - store secrets in environment/platform secrets only in production**

5. **Initialize Database:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

6. **Run Development Server:**
   ```bash
   npm run dev
   # or
   bun run dev
   ```

7. **Open the app:**
   Navigate to [http://localhost:3000](http://localhost:3000)

### First-Time Synchronization

1. Open the app in your browser
2. Click **Connect with Strava**
3. Authorize the app to access your Strava data
4. You'll be redirected back to the app
5. Navigate to **Settings** or wait for the initial sync to complete
6. Visit the **Stats** page to see your running history

## 📋 Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Prisma database connection string (pooled connection) |
| `DIRECT_URL` | ✅ | Direct database connection for migrations |
| `STRAVA_CLIENT_ID` | ✅ | Your Strava OAuth client ID |
| `STRAVA_CLIENT_SECRET` | ✅ | Your Strava OAuth client secret (keep secret!) |
| `STRAVA_REDIRECT_URI` | ✅ | OAuth callback URL (must match Strava settings) |
| `OPENROUTESERVICE_API_KEY` | ✅ | API key for route planning and elevation data |

## 🚀 Deployment

### Deploy to Vercel

1. **Prerequisites:**
   - Vercel account at [vercel.com](https://vercel.com)
   - Prisma Cloud account at [cloud.prisma.io](https://cloud.prisma.io) (optional, for managed PostgreSQL)
   - Strava OAuth app created

2. **Set Up PostgreSQL Database:**
   - Use Prisma Cloud, Neon, or any PostgreSQL provider
   - Obtain connection strings:
     - `DATABASE_URL` (pooled connection)
     - `DIRECT_URL` (direct connection for migrations)

3. **Deploy via GitHub Integration:**
   - Push your code to GitHub
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repository
   - Configure:
     - **Framework Preset**: Next.js
     - **Build Command**: `npm run build` (or `bun run build`)
     - **Output Directory**: `.next`

4. **Configure Environment Variables in Vercel:**
   ```
   STRAVA_CLIENT_ID=<your_strava_client_id>
   STRAVA_CLIENT_SECRET=<your_strava_client_secret>
   STRAVA_REDIRECT_URI=https://your-app.vercel.app/api/auth/callback
   OPENROUTESERVICE_API_KEY=<your_api_key>
   DATABASE_URL=<from_database_provider>
   DIRECT_URL=<from_database_provider>
   ```
   
   **⚠️ Important**: Update your Strava OAuth redirect URI to match your Vercel domain!

5. **Run Database Migrations:**
   After first deployment, run migrations:
   ```bash
   vercel env pull .env.local
   bunx prisma migrate deploy
   ```

6. **Update Strava OAuth Settings:**
   - Go to [strava.com/settings/api](https://www.strava.com/settings/api)
   - Update **Authorization Callback Domain**: `your-app.vercel.app`

### Deployment Troubleshooting

**Prisma Client not generated:**
```bash
vercel exec -- bunx prisma generate
```

**Database migration errors:**
```bash
bunx prisma migrate reset --force
bunx prisma migrate deploy
```

**Database connection issues:**
- Verify all Prisma environment variables are set correctly
- Ensure `DIRECT_URL` is used for migrations, `DATABASE_URL` for queries
- Check database provider status page

## 🔒 Security & Privacy
- Store all secrets only in environment/config secrets—never commit them to version control
- Use server-only env variables for sensitive keys (e.g., `STRAVA_CLIENT_SECRET`, `OPENROUTESERVICE_API_KEY`)
- Cookies storing tokens are `httpOnly` and `secure` in production
- OAuth tokens are securely stored and refreshed automatically

## Troubleshooting

### "Invalid Auth" Error
- Ensure `STRAVA_REDIRECT_URI` exactly matches your Strava app settings
- Verify `localhost` is set as the Authorization Callback Domain in Strava settings (for local development)

### Database Connection Timeout
- If using a serverless database (Neon, Prisma Cloud), ensure `DATABASE_URL` is the pooled connection string
- Check database provider status and network connectivity
- Verify credentials are correct

### Strava Sync Not Working
- Check that `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are correct
- Verify the user has authorized the app at `/api/auth/login`
- Check browser network tab for API response errors

### Build Failures
- Run `npm install` to ensure dependencies are installed
- Run `npx prisma generate` to regenerate Prisma Client
- Check that all required environment variables are set

## Roadmap

**Short-term**
- ✅ Fix server API TypeScript typings and add tests
- ✅ Improve deployment documentation
- Expand race prediction algorithms
- Add more training plan templates

**Medium-term**
- Multi-activity support (cycling, swimming, etc.)
- Data export (CSV/GPX)
- Advanced analytics and trend analysis
- Privacy auditing tools

**Long-term**
- Team/group support
- Scaling for large datasets
- Mobile app integration

## Contributing

Contributions, issues, and feature requests are welcome! Please open a GitHub issue first for major work.

- Fork the repo and create a feature branch
- Run the app locally and add tests for new behavior
- Ensure code follows the project's TypeScript/linting standards
- Open a PR with a clear description and linked issue

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Maintained with ❤️ — PRs welcome!
