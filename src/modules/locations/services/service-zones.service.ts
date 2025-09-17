import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateServiceZoneDto } from '../dto/create-service-zone.dto';
import { GeolocationService, Coordinates } from './geolocation.service';

@Injectable()
export class ServiceZonesService {
  constructor(
    private prisma: PrismaService,
    private geolocation: GeolocationService,
  ) {}

  async create(dto: CreateServiceZoneDto) {
    return this.prisma.serviceZone.create({
      data: {
        ...dto,
        baseFare: dto.baseFare,
        perKmRate: dto.perKmRate,
        perMinuteRate: dto.perMinuteRate,
      },
    });
  }

  async findAll(country?: string, city?: string) {
    return this.prisma.serviceZone.findMany({
      where: {
        isActive: true,
        ...(country && { country }),
        ...(city && { city }),
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const zone = await this.prisma.serviceZone.findUnique({
      where: { id },
    });
    
    if (!zone) {
      throw new NotFoundException('Zone de service non trouvée');
    }
    
    return zone;
  }

  async findZoneByLocation(coordinates: Coordinates) {
    const zones = await this.prisma.serviceZone.findMany({
      where: { isActive: true },
    });

    for (const zone of zones) {
      if (this.geolocation.isPointInZone(coordinates, zone.geometry)) {
        return zone;
      }
    }

    return null;
  }

  async update(id: string, dto: Partial<CreateServiceZoneDto>) {
    await this.findById(id);
    
    return this.prisma.serviceZone.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    await this.findById(id);
    
    return this.prisma.serviceZone.update({
      where: { id },
      data: { isActive: false },
    });
  }
}