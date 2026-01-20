-- CreateEnum
CREATE TYPE "DriverActivityStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ON_RIDE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CARPOOL_REQUEST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'CARPOOL_REQUEST_ACCEPTED';
ALTER TYPE "NotificationType" ADD VALUE 'CARPOOL_REQUEST_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'CARPOOL_REQUEST_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'CARPOOL_PASSENGER_JOINED';
ALTER TYPE "NotificationType" ADD VALUE 'CARPOOL_PASSENGER_LEFT';
ALTER TYPE "NotificationType" ADD VALUE 'CARPOOL_ROUTE_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE 'CARPOOL_REMINDER';

-- AlterTable
ALTER TABLE "driver_profiles" ADD COLUMN     "activityStatus" "DriverActivityStatus" NOT NULL DEFAULT 'OFFLINE';

-- AlterTable
ALTER TABLE "reservations" ADD COLUMN     "basePrice" DECIMAL(8,2),
ADD COLUMN     "currentSharedPassengers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "destinationLatitude" DOUBLE PRECISION,
ADD COLUMN     "destinationLongitude" DOUBLE PRECISION,
ADD COLUMN     "isSharedRide" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxDetourMinutes" INTEGER DEFAULT 15,
ADD COLUMN     "maxSharedPassengers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pickupLatitude" DOUBLE PRECISION,
ADD COLUMN     "pickupLongitude" DOUBLE PRECISION,
ADD COLUMN     "sharePreference" TEXT,
ADD COLUMN     "sharedPricePerPerson" DECIMAL(8,2),
ADD COLUMN     "totalSavings" DECIMAL(8,2);

-- CreateTable
CREATE TABLE "shared_passengers" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "passengerId" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "destLatitude" DOUBLE PRECISION,
    "destLongitude" DOUBLE PRECISION,
    "pickupOrder" INTEGER NOT NULL,
    "dropoffOrder" INTEGER NOT NULL,
    "fareShare" DECIMAL(8,2) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shared_passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetReservationId" TEXT NOT NULL,
    "pickupAddress" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "pickupLatitude" DOUBLE PRECISION NOT NULL,
    "pickupLongitude" DOUBLE PRECISION NOT NULL,
    "destLatitude" DOUBLE PRECISION NOT NULL,
    "destLongitude" DOUBLE PRECISION NOT NULL,
    "routeCompatibility" DOUBLE PRECISION,
    "additionalDistance" DOUBLE PRECISION,
    "additionalTime" INTEGER,
    "estimatedFare" DECIMAL(8,2) NOT NULL,
    "potentialSavings" DECIMAL(8,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestMessage" TEXT,
    "responseMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "carpool_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ride_tracking_points" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "speed" DOUBLE PRECISION,
    "heading" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "altitude" DOUBLE PRECISION,

    CONSTRAINT "ride_tracking_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shared_passengers_reservationId_idx" ON "shared_passengers"("reservationId");

-- CreateIndex
CREATE INDEX "shared_passengers_passengerId_idx" ON "shared_passengers"("passengerId");

-- CreateIndex
CREATE INDEX "carpool_requests_targetReservationId_status_idx" ON "carpool_requests"("targetReservationId", "status");

-- CreateIndex
CREATE INDEX "carpool_requests_requesterId_idx" ON "carpool_requests"("requesterId");

-- CreateIndex
CREATE INDEX "ride_tracking_points_rideId_timestamp_idx" ON "ride_tracking_points"("rideId", "timestamp");

-- CreateIndex
CREATE INDEX "ride_tracking_points_timestamp_idx" ON "ride_tracking_points"("timestamp");

-- CreateIndex
CREATE INDEX "reservations_isSharedRide_scheduledAt_idx" ON "reservations"("isSharedRide", "scheduledAt");

-- CreateIndex
CREATE INDEX "reservations_pickupLatitude_pickupLongitude_isSharedRide_idx" ON "reservations"("pickupLatitude", "pickupLongitude", "isSharedRide");

-- AddForeignKey
ALTER TABLE "shared_passengers" ADD CONSTRAINT "shared_passengers_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shared_passengers" ADD CONSTRAINT "shared_passengers_passengerId_fkey" FOREIGN KEY ("passengerId") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_requests" ADD CONSTRAINT "carpool_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_requests" ADD CONSTRAINT "carpool_requests_targetReservationId_fkey" FOREIGN KEY ("targetReservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ride_tracking_points" ADD CONSTRAINT "ride_tracking_points_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
