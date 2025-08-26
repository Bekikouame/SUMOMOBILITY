-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('CLIENT', 'DRIVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."DriverStatus" AS ENUM ('PENDING', 'APPROVED', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "public"."RideStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'MOBILE_MONEY', 'WALLET');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."VehicleStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'INACTIVE');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'CLIENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "country" TEXT,
    "city" TEXT,
    "region" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."client_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredPaymentMethod" "public"."PaymentMethod",
    "defaultPickupAddress" TEXT,
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "vipStatus" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."driver_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."DriverStatus" NOT NULL DEFAULT 'PENDING',
    "licenseNumber" TEXT,
    "driverType" TEXT,
    "workingHours" TEXT,
    "maxRadius" INTEGER,
    "rating" DOUBLE PRECISION,
    "totalRides" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."driver_documents" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "docNumber" TEXT,
    "fileUrl" TEXT,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vehicles" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "plateNumber" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "year" INTEGER,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "status" "public"."VehicleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cancellation_causes" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,

    CONSTRAINT "cancellation_causes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reservations" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "status" "public"."ReservationStatus" NOT NULL DEFAULT 'PENDING',
    "pickupAddress" TEXT,
    "destinationAddress" TEXT,
    "estimatedDistance" DOUBLE PRECISION,
    "estimatedPrice" DECIMAL(10,2),
    "passengerCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "rideId" TEXT,
    "cancellationCauseId" TEXT,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rides" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "driverId" TEXT,
    "vehicleId" TEXT,
    "rideType" TEXT,
    "pickupAddress" TEXT,
    "destinationAddress" TEXT,
    "pickupLatitude" DOUBLE PRECISION,
    "pickupLongitude" DOUBLE PRECISION,
    "destinationLatitude" DOUBLE PRECISION,
    "destinationLongitude" DOUBLE PRECISION,
    "requestedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "distanceKm" DOUBLE PRECISION,
    "durationMinutes" INTEGER,
    "baseFare" DECIMAL(10,2),
    "totalFare" DECIMAL(10,2),
    "driverEarnings" DECIMAL(10,2),
    "platformFee" DECIMAL(10,2),
    "passengerCount" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "status" "public"."RideStatus" NOT NULL DEFAULT 'REQUESTED',
    "cancellationCauseId" TEXT,
    "canceledAt" TIMESTAMP(3),
    "canceledBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ratings" (
    "id" TEXT NOT NULL,
    "rideId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "punctuality" INTEGER,
    "cleanliness" INTEGER,
    "driving" INTEGER,
    "courtesy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "method" "public"."PaymentMethod" NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" TEXT,
    "processorFee" DECIMAL(10,2),
    "netAmount" DECIMAL(12,2),
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ride_payments" (
    "rideId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL DEFAULT 'FARE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ride_payments_pkey" PRIMARY KEY ("rideId","paymentId")
);

-- CreateTable
CREATE TABLE "public"."reservation_payments" (
    "reservationId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "paymentType" TEXT NOT NULL DEFAULT 'DEPOSIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_payments_pkey" PRIMARY KEY ("reservationId","paymentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "public"."users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "public"."users"("role");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "public"."users"("isActive");

-- CreateIndex
CREATE INDEX "users_country_city_idx" ON "public"."users"("country", "city");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "public"."users"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "client_profiles_userId_key" ON "public"."client_profiles"("userId");

-- CreateIndex
CREATE INDEX "client_profiles_loyaltyPoints_idx" ON "public"."client_profiles"("loyaltyPoints");

-- CreateIndex
CREATE INDEX "client_profiles_vipStatus_idx" ON "public"."client_profiles"("vipStatus");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_userId_key" ON "public"."driver_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_licenseNumber_key" ON "public"."driver_profiles"("licenseNumber");

-- CreateIndex
CREATE INDEX "driver_profiles_status_idx" ON "public"."driver_profiles"("status");

-- CreateIndex
CREATE INDEX "driver_profiles_rating_idx" ON "public"."driver_profiles"("rating");

-- CreateIndex
CREATE INDEX "driver_profiles_totalRides_idx" ON "public"."driver_profiles"("totalRides");

-- CreateIndex
CREATE INDEX "driver_documents_driverId_status_idx" ON "public"."driver_documents"("driverId", "status");

-- CreateIndex
CREATE INDEX "driver_documents_docType_status_idx" ON "public"."driver_documents"("docType", "status");

-- CreateIndex
CREATE INDEX "driver_documents_expiresAt_idx" ON "public"."driver_documents"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_plateNumber_key" ON "public"."vehicles"("plateNumber");

-- CreateIndex
CREATE INDEX "vehicles_driverId_idx" ON "public"."vehicles"("driverId");

-- CreateIndex
CREATE INDEX "vehicles_status_idx" ON "public"."vehicles"("status");

-- CreateIndex
CREATE INDEX "vehicles_verified_idx" ON "public"."vehicles"("verified");

-- CreateIndex
CREATE INDEX "vehicles_plateNumber_idx" ON "public"."vehicles"("plateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "cancellation_causes_label_key" ON "public"."cancellation_causes"("label");

-- CreateIndex
CREATE INDEX "cancellation_causes_active_idx" ON "public"."cancellation_causes"("active");

-- CreateIndex
CREATE INDEX "cancellation_causes_category_idx" ON "public"."cancellation_causes"("category");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_rideId_key" ON "public"."reservations"("rideId");

-- CreateIndex
CREATE INDEX "reservations_clientId_idx" ON "public"."reservations"("clientId");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "public"."reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_scheduledAt_idx" ON "public"."reservations"("scheduledAt");

-- CreateIndex
CREATE INDEX "reservations_canceledAt_idx" ON "public"."reservations"("canceledAt");

-- CreateIndex
CREATE INDEX "rides_clientId_idx" ON "public"."rides"("clientId");

-- CreateIndex
CREATE INDEX "rides_driverId_idx" ON "public"."rides"("driverId");

-- CreateIndex
CREATE INDEX "rides_vehicleId_idx" ON "public"."rides"("vehicleId");

-- CreateIndex
CREATE INDEX "rides_status_idx" ON "public"."rides"("status");

-- CreateIndex
CREATE INDEX "rides_requestedAt_idx" ON "public"."rides"("requestedAt");

-- CreateIndex
CREATE INDEX "rides_completedAt_idx" ON "public"."rides"("completedAt");

-- CreateIndex
CREATE INDEX "rides_pickupLatitude_pickupLongitude_idx" ON "public"."rides"("pickupLatitude", "pickupLongitude");

-- CreateIndex
CREATE INDEX "ratings_rideId_idx" ON "public"."ratings"("rideId");

-- CreateIndex
CREATE INDEX "ratings_score_idx" ON "public"."ratings"("score");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionId_key" ON "public"."payments"("transactionId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "public"."payments"("status");

-- CreateIndex
CREATE INDEX "payments_method_idx" ON "public"."payments"("method");

-- CreateIndex
CREATE INDEX "payments_createdAt_idx" ON "public"."payments"("createdAt");

-- CreateIndex
CREATE INDEX "payments_transactionId_idx" ON "public"."payments"("transactionId");

-- CreateIndex
CREATE INDEX "ride_payments_paymentId_idx" ON "public"."ride_payments"("paymentId");

-- CreateIndex
CREATE INDEX "reservation_payments_paymentId_idx" ON "public"."reservation_payments"("paymentId");

-- AddForeignKey
ALTER TABLE "public"."client_profiles" ADD CONSTRAINT "client_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_profiles" ADD CONSTRAINT "driver_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_documents" ADD CONSTRAINT "driver_documents_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reservations" ADD CONSTRAINT "reservations_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reservations" ADD CONSTRAINT "reservations_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reservations" ADD CONSTRAINT "reservations_cancellationCauseId_fkey" FOREIGN KEY ("cancellationCauseId") REFERENCES "public"."cancellation_causes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rides" ADD CONSTRAINT "rides_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."client_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rides" ADD CONSTRAINT "rides_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rides" ADD CONSTRAINT "rides_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rides" ADD CONSTRAINT "rides_cancellationCauseId_fkey" FOREIGN KEY ("cancellationCauseId") REFERENCES "public"."cancellation_causes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ratings" ADD CONSTRAINT "ratings_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ride_payments" ADD CONSTRAINT "ride_payments_rideId_fkey" FOREIGN KEY ("rideId") REFERENCES "public"."rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ride_payments" ADD CONSTRAINT "ride_payments_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reservation_payments" ADD CONSTRAINT "reservation_payments_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "public"."reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reservation_payments" ADD CONSTRAINT "reservation_payments_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
