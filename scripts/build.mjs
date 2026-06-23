import { spawnSync } from "node:child_process";
import process from "node:process";

function run(command, args, { optional = false } = {}) {
  console.log(`\n> ${command} ${args.join(" ")}\n`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    if (optional) {
      console.warn(
        `\n[build] Optional step failed (${command} ${args.join(" ")}); continuing.\n`
      );
      return;
    }
    process.exit(result.status ?? 1);
  }
}

// On Vercel (or when explicitly requested), apply pending migrations before
// building so the deployed app never runs against a schema ahead of the DB.
// GitHub Actions / generic CI should NOT migrate — no live DB in PR checks.
// Local `npm run build` skips this — use `npm run db:migrate` explicitly.
const shouldMigrate =
  process.env.RUN_DB_MIGRATE === "1" ||
  (process.env.VERCEL === "1" && process.env.SKIP_DB_MIGRATE !== "1");

if (shouldMigrate) {
  if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
    console.error(
      "[build] DATABASE_URL (or DIRECT_URL) is required to run migrations on deploy."
    );
    process.exit(1);
  }
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  console.log(
    "[build] Skipping prisma migrate deploy (set VERCEL=1 or RUN_DB_MIGRATE=1 to enable; SKIP_DB_MIGRATE=1 forces off)."
  );
}

run("node", ["scripts/generate-sw.mjs"]);
run("npx", ["prisma", "generate", "--no-engine"]);
run("npx", ["next", "build", "--turbopack"]);
