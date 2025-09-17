-- CreateTable
CREATE TABLE "public"."service_zones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "geometry" JSONB NOT NULL,
    "baseFare" DECIMAL(8,2) NOT NULL,
    "perKmRate" DECIMAL(6,2) NOT NULL,
    "perMinuteRate" DECIMAL(6,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxRadius" INTEGER NOT NULL DEFAULT 50,
    "operatingHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."points_of_interest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "address" TEXT,
    "description" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "rating" DOUBLE PRECISION,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "points_of_interest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."driver_locations" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "heading" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "isAvailable" BOOLEAN NOT NULL DEFAULT false,
    "serviceZoneId" TEXT,
    "lastPing" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batteryLevel" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."system_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."admin_logs" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filters" JSONB,
    "dateFrom" TIMESTAMP(3),
    "dateTo" TIMESTAMP(3),
    "data" JSONB NOT NULL,
    "fileUrl" TEXT,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_zones_isActive_idx" ON "public"."service_zones"("isActive");

-- CreateIndex
CREATE INDEX "service_zones_country_city_idx" ON "public"."service_zones"("country", "city");

-- CreateIndex
CREATE INDEX "points_of_interest_category_isActive_idx" ON "public"."points_of_interest"("category", "isActive");

-- CreateIndex
CREATE INDEX "points_of_interest_latitude_longitude_idx" ON "public"."points_of_interest"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "points_of_interest_isPopular_idx" ON "public"."points_of_interest"("isPopular");

-- CreateIndex
CREATE INDEX "points_of_interest_country_city_idx" ON "public"."points_of_interest"("country", "city");

-- CreateIndex
CREATE UNIQUE INDEX "driver_locations_driverId_key" ON "public"."driver_locations"("driverId");

-- CreateIndex
CREATE INDEX "driver_locations_latitude_longitude_isOnline_isAvailable_idx" ON "public"."driver_locations"("latitude", "longitude", "isOnline", "isAvailable");

-- CreateIndex
CREATE INDEX "driver_locations_lastPing_idx" ON "public"."driver_locations"("lastPing");

-- CreateIndex
CREATE INDEX "driver_locations_serviceZoneId_idx" ON "public"."driver_locations"("serviceZoneId");

-- CreateIndex
CREATE UNIQUE INDEX "system_configs_key_key" ON "public"."system_configs"("key");

-- CreateIndex
CREATE INDEX "system_configs_category_idx" ON "public"."system_configs"("category");

-- CreateIndex
CREATE INDEX "system_configs_isPublic_idx" ON "public"."system_configs"("isPublic");

-- CreateIndex
CREATE INDEX "admin_logs_adminId_idx" ON "public"."admin_logs"("adminId");

-- CreateIndex
CREATE INDEX "admin_logs_action_idx" ON "public"."admin_logs"("action");

-- CreateIndex
CREATE INDEX "admin_logs_resource_idx" ON "public"."admin_logs"("resource");

-- CreateIndex
CREATE INDEX "admin_logs_createdAt_idx" ON "public"."admin_logs"("createdAt");

-- CreateIndex
CREATE INDEX "reports_type_idx" ON "public"."reports"("type");

-- CreateIndex
CREATE INDEX "reports_generatedBy_idx" ON "public"."reports"("generatedBy");

-- CreateIndex
CREATE INDEX "reports_createdAt_idx" ON "public"."reports"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."driver_locations" ADD CONSTRAINT "driver_locations_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "public"."driver_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."driver_locations" ADD CONSTRAINT "driver_locations_serviceZoneId_fkey" FOREIGN KEY ("serviceZoneId") REFERENCES "public"."service_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."admin_logs" ADD CONSTRAINT "admin_logs_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_generatedBy_fkey" FOREIGN KEY ("generatedBy") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
