import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load .env.local first, then .env
config({ path: ".env.local" });
config({ path: ".env" });

// `prisma generate` / `validate` load this config but do not connect to the DB.
// Allow install/CI without a real secret; migrate/deploy still need a real URL at runtime.
const datasourceUrl =
  process.env.DATABASE_URL ??
  process.env.DIRECT_URL ??
  "postgresql://prisma:prisma@127.0.0.1:5432/prisma?schema=public";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  engine: "classic",
  datasource: {
    url: datasourceUrl,
  },
});
