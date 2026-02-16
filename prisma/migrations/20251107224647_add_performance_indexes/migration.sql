-- CreateIndex
CREATE INDEX "Activity_sportType_idx" ON "Activity"("sportType");

-- CreateIndex
CREATE INDEX "Activity_userId_startDate_idx" ON "Activity"("userId", "startDate");

-- CreateIndex
CREATE INDEX "Activity_userId_sportType_startDate_idx" ON "Activity"("userId", "sportType", "startDate");

-- CreateIndex
CREATE INDEX "Activity_stravaId_idx" ON "Activity"("stravaId");
