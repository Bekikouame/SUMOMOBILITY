import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePointOfInterestDto } from '../dto/create-poi.dto';
import { GeolocationService, Coordinates } from './geolocation.service';

@Injectable()
export class PointsOfInterestService {
  constructor(
    private prisma: PrismaService,
    private geolocation: GeolocationService,
  ) {}

  async create(dto: CreatePointOfInterestDto) {
    return this.prisma.pointOfInterest.create({
      data: dto,
    });
  }

  async findNearby(
    coordinates: Coordinates,
    radiusKm: number = 10,
    category?: string,
    limit: number = 20,
  ) {
    const pois = await this.prisma.pointOfInterest.findMany({
      where: {
        isActive: true,
        ...(category && { category }),
      },
      orderBy: [
        { isPopular: 'desc' },
        { rating: 'desc' },
      ],
      take: limit * 3,
    });

    const nearbyPois = pois
      .map(poi => ({
        ...poi,
        distanceKm: this.geolocation.calculateDistance(
          coordinates,
          { latitude: poi.latitude, longitude: poi.longitude }
        ),
      }))
      .filter(poi => poi.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, limit);

    return nearbyPois;
  }

  async findPopular(country?: string, city?: string, limit: number = 10) {
    return this.prisma.pointOfInterest.findMany({
      where: {
        isActive: true,
        isPopular: true,
        ...(country && { country }),
        ...(city && { city }),
      },
      orderBy: [
        { rating: 'desc' },
        { name: 'asc' },
      ],
      take: limit,
    });
  }

  async findByCategory(
    category: string,
    country?: string,
    city?: string,
  ) {
    return this.prisma.pointOfInterest.findMany({
      where: {
        category: category.toUpperCase(),
        isActive: true,
        ...(country && { country }),
        ...(city && { city }),
      },
      orderBy: [
        { isPopular: 'desc' },
        { rating: 'desc' },
        { name: 'asc' },
      ],
    });
  }
}