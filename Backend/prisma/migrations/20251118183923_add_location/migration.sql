/*
  Warnings:

  - A unique constraint covering the columns `[emergencyId,responderId]` on the table `ResponderEmergency` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "Location" AS ENUM ('URBAN', 'SEMI_URBAN', 'RURAL');

-- AlterTable
ALTER TABLE "Emergency" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "available" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "locationType" "Location" NOT NULL DEFAULT 'URBAN';

-- CreateIndex
CREATE INDEX "Emergency_status_createdAt_idx" ON "Emergency"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_status_priority_idx" ON "Notification"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "ResponderEmergency_emergencyId_responderId_key" ON "ResponderEmergency"("emergencyId", "responderId");

-- CreateIndex
CREATE INDEX "User_latitude_longitude_idx" ON "User"("latitude", "longitude");
