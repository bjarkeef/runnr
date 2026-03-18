# Database Setup

Runnr uses PostgreSQL through Prisma.

Recommended for most people: use Docker (Option 1).

You need two environment variables:

- `DATABASE_URL`: main runtime connection
- `DIRECT_URL`: direct connection for Prisma migrations

For local development, it is fine to use the same URL for both.

## Option 1: PostgreSQL With Docker (Fastest)

Start PostgreSQL in Docker:

```bash
docker run --name runnr-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=runnr -p 5432:5432 -d postgres:16
```

Use in `.env.local`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/runnr
DIRECT_URL=postgresql://postgres:postgres@localhost:5432/runnr
```

Then apply schema:

```bash
npm run db:migrate
```

## Option 2: Local PostgreSQL Install

1. Install PostgreSQL locally.
2. Create database `runnr`.
3. Put credentials in `.env.local`.

Example:

```env
DATABASE_URL=postgresql://myuser:mypassword@localhost:5432/runnr
DIRECT_URL=postgresql://myuser:mypassword@localhost:5432/runnr
```

Apply schema:

```bash
npm run db:migrate
```

## Option 3: Cloud PostgreSQL (Neon, Supabase, Railway, etc.)

Most providers give:

- A pooled connection URL (better for app runtime)
- A direct connection URL (needed for migrations)

Use:

```env
DATABASE_URL=<pooled_url_if_available>
DIRECT_URL=<direct_url>
```

If only one URL is provided, use it for both.

Apply schema:

```bash
npm run db:migrate
```

## Prisma Commands You Will Use

- Apply existing migrations (safe default):

```bash
npm run db:migrate
```

- Push schema directly (local/dev only):

```bash
npm run db:push
```

- Open Prisma Studio:

```bash
npm run db:studio
```

## Production Note

In production:

1. Run migrations (`prisma migrate deploy`) in your deploy pipeline.
2. Keep `DATABASE_URL` and `DIRECT_URL` in platform secrets.
3. Never commit `.env.local`.
