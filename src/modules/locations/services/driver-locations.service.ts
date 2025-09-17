import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {  FindNearbyDriversDto } from '../dto/find-nearby-drivers.dto';
import {UpdateDriverLocationDto} from '../dto/update-driver-location.dto'
import { GeolocationService } from './geolocation.service';
import { ServiceZonesService } from './service-zones.service';

@Injectable()
export class DriverLocationsService {
  constructor(
    private prisma: PrismaService,
    private geolocation: GeolocationService,
    private serviceZones: ServiceZonesService,
  ) {}

  async updateLocation(driverId: string, dto: UpdateDriverLocationDto) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
    });

    if (!driver || driver.status !== 'APPROVED') {
      throw new ForbiddenException('Chauffeur non autorisé');
    }

    const currentZone = await this.serviceZones.findZoneByLocation({
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    return this.prisma.driverLocation.upsert({
      where: { driverId },
      update: {
        ...dto,
        serviceZoneId: currentZone?.id,
        lastPing: new Date(),
      },
      create: {
        driverId,
        ...dto,
        serviceZoneId: currentZone?.id,
      },
      include: {
        currentZone: true,
        driver: {
          include: {
            user: {
              select: { firstName: true, lastName: true, phone: true },
            },
            vehicles: {
              where: { status: 'AVAILABLE' },
              select: { id: true, plateNumber: true, brand: true, model: true, capacity: true },
            },
          },
        },
      },
    });
  }

  async findNearbyDrivers(dto: FindNearbyDriversDto) {
    const { latitude, longitude, radiusKm = 5, limit = 10 } = dto;

    const drivers = await this.prisma.driverLocation.findMany({
      where: {
        isOnline: true,
        isAvailable: true,
        lastPing: {
          gte: new Date(Date.now() - 5 * 60 * 1000),
        },
      },
      include: {
        driver: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
            vehicles: {
              where: { status: 'AVAILABLE' },
              select: { id: true, plateNumber: true, brand: true, model: true, capacity: true },
            },
          },
        },
        currentZone: true,
      },
      take: limit * 3,
    });

    const nearbyDrivers = drivers
      .map(driverLoc => ({
        ...driverLoc,
        distanceKm: this.geolocation.calculateDistance(
          { latitude, longitude },
          { latitude: driverLoc.latitude, longitude: driverLoc.longitude }
        ),
        estimatedArrival: this.geolocation.estimateDuration(
          this.geolocation.calculateDistance(
            { latitude, longitude },
            { latitude: driverLoc.latitude, longitude: driverLoc.longitude }
          )
        ),
      }))
      .filter(driver => driver.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return nearbyDrivers;
  }

  async getDriverLocation(driverId: string) {
    return this.prisma.driverLocation.findUnique({
      where: { driverId },
      include: {
        currentZone: true,
      },
    });
  }

  async setDriverOffline(driverId: string) {
    return this.prisma.driverLocation.updateMany({
      where: { driverId },
      data: {
        isOnline: false,
        isAvailable: false,
      },
    });
  }
}