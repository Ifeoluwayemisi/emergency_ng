-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'RESPONDER');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmergencyCategory" AS ENUM ('CPR', 'BLEEDING', 'BURNS', 'SEIZURE', 'CHOKING', 'ASTHMA', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "phone" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "profileImg" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Emergency" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" "EmergencyCategory" NOT NULL,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "address" TEXT,

    CONSTRAINT "Emergency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponderEmergency" (
    "id" SERIAL NOT NULL,
    "emergencyId" INTEGER NOT NULL,
    "responderId" INTEGER NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ResponderEmergency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirstAid" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirstAid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponderEmergency" ADD CONSTRAINT "ResponderEmergency_emergencyId_fkey" FOREIGN KEY ("emergencyId") REFERENCES "Emergency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponderEmergency" ADD CONSTRAINT "ResponderEmergency_responderId_fkey" FOREIGN KEY ("responderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
