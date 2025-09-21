// src/modules/profiles/profiles.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole, DriverStatus, DocumentStatus } from '@prisma/client';
import {  CreateClientProfileDto,UpdateClientProfileDto,} from './dto/client-profile.dto';
import {CreateDriverProfileDto,  UpdateDriverProfileDto,} from './dto/driver-profile.dto';
import {CreateDriverDocumentDto,UpdateDriverDocumentDto,} from './dto/driver-document.dto'


@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== CLIENT PROFILES ====================

  async createClientProfile(userId: string, dto: CreateClientProfileDto) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundException('Utilisateur non trouvé');
  }

  if (user.role !== UserRole.CLIENT) {
    throw new BadRequestException('Seuls les clients peuvent créer un profil client');
  }

  //  Retourner le profil existant au lieu de lancer une erreur
  const existingClientProfile = await this.prisma.clientProfile.findUnique({
    where: { userId: userId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
    },
  });

  if (existingClientProfile) {
    return existingClientProfile; 
  }

  return this.prisma.clientProfile.create({
    data: {
      userId,
      ...dto,
    },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
        },
      },
    },
  });
}

  async getClientProfile(profileId: string, requestUserId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            reservations: true,
            rides: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profil client non trouvé');
    }

    // Vérification des permissions
    await this.checkUserAccess(profile.userId, requestUserId);

    return profile;
  }

  async updateClientProfile(profileId: string, dto: UpdateClientProfileDto, requestUserId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException('Profil client non trouvé');
    }

    await this.checkUserAccess(profile.userId, requestUserId);

    return this.prisma.clientProfile.update({
      where: { id: profileId },
      data: dto,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  // ==================== DRIVER PROFILES ====================

  async createDriverProfile(userId: string, dto: CreateDriverProfileDto) {
    console.log('=== DEBUG CRÉATION PROFIL ===');
    console.log('userId:', userId);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
        console.log('Utilisateur trouvé:', !!user, user?.role);
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }
    console.log('Recherche profil existant...');
    if (user.role !== UserRole.DRIVER) {
      throw new BadRequestException('Seuls les chauffeurs peuvent créer un profil chauffeur');
    }

    // Vérification directe au lieu de la relation
    const existingDriverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId: userId }
    });

    if (existingDriverProfile) {
      throw new BadRequestException('Le profil chauffeur existe déjà');
    }

    return this.prisma.driverProfile.create({
      data: {
        userId,
        status: DriverStatus.PENDING,
        ...dto,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
    });
  }

  async getDriverProfile(profileId: string, requestUserId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { id: profileId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            isActive: true,
          },
        },
        vehicles: {
          select: {
            id: true,
            plateNumber: true,
            brand: true,
            model: true,
            status: true,
            verified: true,
          },
        },
        _count: {
          select: {
            documents: true,
            rides: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    await this.checkUserAccess(profile.userId, requestUserId);

    return profile;
  }

  async updateDriverProfile(profileId: string, dto: UpdateDriverProfileDto, requestUserId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    await this.checkUserAccess(profile.userId, requestUserId);

    return this.prisma.driverProfile.update({
      where: { id: profileId },
      data: dto,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
        vehicles: true,
      },
    });
  }

  // ==================== DRIVER DOCUMENTS ====================

  async getDriverDocuments(driverProfileId: string, requestUserId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { id: driverProfileId },
    });

    if (!profile) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    await this.checkUserAccess(profile.userId, requestUserId);

    return this.prisma.driverDocument.findMany({
      where: { driverId: driverProfileId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDriverDocument(driverProfileId: string, dto: CreateDriverDocumentDto, requestUserId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { id: driverProfileId },
    });

    if (!profile) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    await this.checkUserAccess(profile.userId, requestUserId);

    return this.prisma.driverDocument.create({
      data: {
        driverId: driverProfileId,
        status: DocumentStatus.PENDING,
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });
  }

  async updateDriverDocument(documentId: string, dto: UpdateDriverDocumentDto, requestUserId: string) {
    const document = await this.prisma.driverDocument.findUnique({
      where: { id: documentId },
      include: { driver: true },
    });

    if (!document) {
      throw new NotFoundException('Document non trouvé');
    }

    await this.checkUserAccess(document.driver.userId, requestUserId);

    return this.prisma.driverDocument.update({
      where: { id: documentId },
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        reviewedAt: dto.status ? new Date() : undefined,
        reviewedBy: dto.status ? requestUserId : undefined,
      },
    });
  }

  // ==================== MÉTRIQUES ET STATISTIQUES ====================

  async getClientMetrics(profileId: string, requestUserId: string) {
    const profile = await this.prisma.clientProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException('Profil client non trouvé');
    }

    await this.checkUserAccess(profile.userId, requestUserId);

    const [totalReservations, totalRides, completedRides] = await Promise.all([
      this.prisma.reservation.count({
        where: { clientId: profileId },
      }),
      this.prisma.ride.count({
        where: { clientId: profileId },
      }),
      this.prisma.ride.count({
        where: { 
          clientId: profileId,
          status: 'COMPLETED',
        },
      }),
    ]);

    return {
      totalReservations,
      totalRides,
      completedRides,
      loyaltyPoints: profile.loyaltyPoints,
      vipStatus: profile.vipStatus,
    };
  }

  async getDriverMetrics(profileId: string, requestUserId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { id: profileId },
    });

    if (!profile) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    await this.checkUserAccess(profile.userId, requestUserId);

    const [documentsStatus, vehiclesCount] = await Promise.all([
      this.prisma.driverDocument.groupBy({
        by: ['status'],
        where: { driverId: profileId },
        _count: true,
      }),
      this.prisma.vehicle.count({
        where: { driverId: profileId },
      }),
    ]);

    return {
      status: profile.status,
      rating: profile.rating,
      totalRides: profile.totalRides,
      totalEarnings: profile.totalEarnings,
      documentsStatus,
      vehiclesCount,
    };
  }

  // ==================== MÉTHODES UTILITAIRES ====================

  private async checkUserAccess(profileUserId: string, requestUserId: string) {
    const requestUser = await this.prisma.user.findUnique({
      where: { id: requestUserId },
    });

    if (!requestUser) {
      throw new NotFoundException('Utilisateur demandeur non trouvé');
    }

    // L'admin peut tout voir, sinon seul le propriétaire
    if (requestUser.role !== UserRole.ADMIN && profileUserId !== requestUserId) {
      throw new ForbiddenException('Accès non autorisé à ce profil');
    }
  }

  async getExpiredDocuments() {
    return this.prisma.driverDocument.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
        status: DocumentStatus.APPROVED,
      },
      include: {
        driver: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
    });
  }
}