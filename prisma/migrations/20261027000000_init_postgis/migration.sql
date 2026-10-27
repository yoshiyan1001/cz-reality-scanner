-- PostGIS must exist before any table uses the geometry type.
CREATE EXTENSION IF NOT EXISTS postgis;

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MetroLine" AS ENUM ('A', 'B', 'C');

-- CreateTable
CREATE TABLE "MetroStation" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "line" "MetroLine" NOT NULL,
    "line_color" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,

    CONSTRAINT "MetroStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalProperty" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "disposition" TEXT NOT NULL,
    "areaM2" DOUBLE PRECISION NOT NULL,
    "priceCzk" INTEGER NOT NULL,
    "location" geometry(Point, 4326) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhysicalProperty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MetroStation_line_idx" ON "MetroStation"("line");

-- CreateIndex
CREATE INDEX "MetroStation_location_idx" ON "MetroStation" USING GIST ("location");

-- CreateIndex
CREATE UNIQUE INDEX "MetroStation_name_line_key" ON "MetroStation"("name", "line");

-- CreateIndex
CREATE INDEX "PhysicalProperty_location_idx" ON "PhysicalProperty" USING GIST ("location");

