// src/vehicles/vehicles.service.ts
import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVehicleDto } from '../vehicules/dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../vehicules/dto/update-vehicle.dto';
import { VerifyVehicleDto } from '../vehicules/dto/verify-vehicle.dto';
import { UpdateVehicleStatusDto } from '../vehicules/dto/update-status.dto';
import { VehicleStatus, UserRole } from '@prisma/client';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}

  // Créer un nouveau véhicule
  async create(driverId: string, createVehicleDto: CreateVehicleDto) {
    // Vérifier que l'utilisateur est un chauffeur
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true }
    });

    if (!driver) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    // Vérifier l'unicité de la plaque
    const existingVehicle = await this.prisma.vehicle.findUnique({
      where: { plateNumber: createVehicleDto.plateNumber }
    });

    if (existingVehicle) {
      throw new ConflictException('Cette plaque d\'immatriculation existe déjà');
    }

    return this.prisma.vehicle.create({
      data: {
        ...createVehicleDto,
        driverId,
        capacity: createVehicleDto.capacity || 4,
        status: VehicleStatus.AVAILABLE,
        verified: false
      },
      include: {
        driver: {
          include: { user: true }
        }
      }
    });
  }

  // Lister les véhicules selon le rôle
  async findAll(userId: string, userRole: UserRole) {
    if (userRole === UserRole.ADMIN) {
      // Admin voit tous les véhicules
      return this.prisma.vehicle.findMany({
        include: {
          driver: {
            include: { user: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (userRole === UserRole.DRIVER) {
      // Chauffeur voit seulement ses véhicules
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId }
      });

      if (!driver) {
        throw new NotFoundException('Profil chauffeur non trouvé');
      }

      return this.prisma.vehicle.findMany({
        where: { driverId: driver.id },
        include: {
          driver: {
            include: { user: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    throw new ForbiddenException('Accès non autorisé');
  }

  // Détail d'un véhicule
  async findOne(id: string, userId: string, userRole: UserRole) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id },
      include: {
        driver: {
          include: { user: true }
        }
      }
    });

    if (!vehicle) {
      throw new NotFoundException('Véhicule non trouvé');
    }

    // Vérification des permissions
    if (userRole === UserRole.DRIVER) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId }
      });

      if (!driver || vehicle.driverId !== driver.id) {
        throw new ForbiddenException('Accès non autorisé à ce véhicule');
      }
    }

    return vehicle;
  }

  // Modifier un véhicule
  async update(id: string, updateVehicleDto: UpdateVehicleDto, userId: string, userRole: UserRole) {
    const vehicle = await this.findOne(id, userId, userRole);

    // Seuls le propriétaire ou admin peuvent modifier
    if (userRole === UserRole.DRIVER) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId }
      });

      if (!driver || vehicle.driverId !== driver.id) {
        throw new ForbiddenException('Vous ne pouvez modifier que vos propres véhicules');
      }
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: updateVehicleDto,
      include: {
        driver: {
          include: { user: true }
        }
      }
    });
  }

  // Supprimer un véhicule
  async remove(id: string, userId: string, userRole: UserRole) {
    const vehicle = await this.findOne(id, userId, userRole);

    // Vérifier qu'il n'y a pas de courses en cours
    const activeRides = await this.prisma.ride.count({
      where: {
        vehicleId: id,
        status: {
          in: ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS']
        }
      }
    });

    if (activeRides > 0) {
      throw new ConflictException('Impossible de supprimer un véhicule avec des courses actives');
    }

    // Seuls le propriétaire ou admin peuvent supprimer
    if (userRole === UserRole.DRIVER) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId }
      });

      if (!driver || vehicle.driverId !== driver.id) {
        throw new ForbiddenException('Vous ne pouvez supprimer que vos propres véhicules');
      }
    }

    await this.prisma.vehicle.delete({
      where: { id }
    });

    return { message: 'Véhicule supprimé avec succès' };
  }

  // Vérifier un véhicule (Admin seulement)
  async verify(id: string, verifyVehicleDto: VerifyVehicleDto) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id }
    });

    if (!vehicle) {
      throw new NotFoundException('Véhicule non trouvé');
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: {
        verified: verifyVehicleDto.verified,
        verifiedAt: verifyVehicleDto.verified ? new Date() : null
      },
      include: {
        driver: {
          include: { user: true }
        }
      }
    });
  }

  // Changer le statut d'un véhicule
  async updateStatus(id: string, updateStatusDto: UpdateVehicleStatusDto, userId: string, userRole: UserRole) {
    const vehicle = await this.findOne(id, userId, userRole);

    // Seuls le propriétaire ou admin peuvent changer le statut
    if (userRole === UserRole.DRIVER) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId }
      });

      if (!driver || vehicle.driverId !== driver.id) {
        throw new ForbiddenException('Vous ne pouvez modifier que vos propres véhicules');
      }
    }

    return this.prisma.vehicle.update({
      where: { id },
      data: { status: updateStatusDto.status },
      include: {
        driver: {
          include: { user: true }
        }
      }
    });
  }

  // Obtenir les véhicules disponibles dans une zone (pour matching)
  async findAvailableVehicles(latitude?: number, longitude?: number, radius?: number) {
    return this.prisma.vehicle.findMany({
      where: {
        status: VehicleStatus.AVAILABLE,
        verified: true,
        driver: {
          status: 'APPROVED'
        }
      },
      include: {
        driver: {
          include: { user: true }
        }
      }
    });
  }

  // Statistiques pour admin
  async getStatistics() {
    const [total, byStatus, verified, avgCapacity] = await Promise.all([
      this.prisma.vehicle.count(),
      this.prisma.vehicle.groupBy({
        by: ['status'],
        _count: true
      }),
      this.prisma.vehicle.count({ where: { verified: true } }),
      this.prisma.vehicle.aggregate({
        _avg: { capacity: true }
      })
    ]);

    return {
      total,
      verified,
      avgCapacity: avgCapacity._avg.capacity,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}
