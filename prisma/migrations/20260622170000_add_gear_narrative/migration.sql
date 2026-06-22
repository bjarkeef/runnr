-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gearNarrativeTone" TEXT NOT NULL DEFAULT 'whimsical';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gearNarrativeBeta" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "weatherTempC" DOUBLE PRECISION;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "weatherCode" INTEGER;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "weatherPrecipMm" DOUBLE PRECISION;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "weatherWindKmh" DOUBLE PRECISION;
ALTER TABLE "Activity" ADD COLUMN IF NOT EXISTS "weatherFetchedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Activity_userId_gearId_idx" ON "Activity"("userId", "gearId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "GearNarrative" (
    "id" TEXT NOT NULL,
    "gearId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "archetypeKey" TEXT NOT NULL,
    "nicknameKey" TEXT NOT NULL,
    "traitKeys" JSONB NOT NULL,
    "firstRunAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "totalDistanceM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paceBuckets" JSONB NOT NULL,
    "terrainBuckets" JSONB NOT NULL,
    "weatherBuckets" JSONB NOT NULL,
    "timeBuckets" JSONB NOT NULL,
    "seasonBuckets" JSONB NOT NULL,
    "chapters" JSONB NOT NULL,
    "milestones" JSONB NOT NULL,
    "highlights" JSONB NOT NULL,
    "lifePath" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearNarrative_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GearNarrative_gearId_key" ON "GearNarrative"("gearId");
CREATE UNIQUE INDEX IF NOT EXISTS "GearNarrative_userId_nicknameKey_key" ON "GearNarrative"("userId", "nicknameKey");
CREATE INDEX IF NOT EXISTS "GearNarrative_userId_idx" ON "GearNarrative"("userId");

DO $$ BEGIN
  ALTER TABLE "GearNarrative" ADD CONSTRAINT "GearNarrative_gearId_fkey" FOREIGN KEY ("gearId") REFERENCES "Gear"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GearNarrative" ADD CONSTRAINT "GearNarrative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
