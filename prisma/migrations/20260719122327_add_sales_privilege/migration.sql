-- CreateEnum
CREATE TYPE "SalesPrivilege" AS ENUM ('JUNIOR', 'SENIOR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "salesPrivilege" "SalesPrivilege";

-- Backfill existing SALES users to SENIOR to preserve current behavior
UPDATE "users" SET "salesPrivilege" = 'SENIOR' WHERE "role" = 'SALES' AND "salesPrivilege" IS NULL;
