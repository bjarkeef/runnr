-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "weatherCode" INTEGER,
ADD COLUMN     "weatherFetchedAt" TIMESTAMP(3),
ADD COLUMN     "weatherPrecipMm" DOUBLE PRECISION,
ADD COLUMN     "weatherTempC" DOUBLE PRECISION,
ADD COLUMN     "weatherWindKmh" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "gearNarrativeTone" TEXT NOT NULL DEFAULT 'whimsical';

-- CreateTable
CREATE TABLE "GearNarrative" (
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

-- CreateIndex
CREATE UNIQUE INDEX "GearNarrative_gearId_key" ON "GearNarrative"("gearId");

-- CreateIndex
CREATE INDEX "GearNarrative_userId_idx" ON "GearNarrative"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GearNarrative_userId_nicknameKey_key" ON "GearNarrative"("userId", "nicknameKey");

-- CreateIndex
CREATE INDEX "Activity_userId_gearId_idx" ON "Activity"("userId", "gearId");

-- AddForeignKey
ALTER TABLE "Gear" ADD CONSTRAINT "Gear_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearNarrative" ADD CONSTRAINT "GearNarrative_gearId_fkey" FOREIGN KEY ("gearId") REFERENCES "Gear"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearNarrative" ADD CONSTRAINT "GearNarrative_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
