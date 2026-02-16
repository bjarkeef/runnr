-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "gearId" TEXT,
ADD COLUMN     "kudosCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Gear" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandName" TEXT,
    "modelName" TEXT,
    "description" TEXT,
    "distance" DOUBLE PRECISION NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,
    "retired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gear_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Gear_userId_idx" ON "Gear"("userId");
