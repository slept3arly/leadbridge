-- CreateIndex
CREATE INDEX "Lead_assignedUserId_isDeleted_updatedAt_idx" ON "Lead"("assignedUserId", "isDeleted", "updatedAt");

-- CreateIndex
CREATE INDEX "Lead_isDeleted_createdAt_idx" ON "Lead"("isDeleted", "createdAt");
