// src/modules/drivers/drivers.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { DriverActivityStatus } from 'generated/prisma/wasm';

@Injectable()
export class DriversService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Mettre à jour le statut d'activité d'un chauffeur (ONLINE/OFFLINE)
   */
  async updateDriverActivityStatus(userId: string, status: DriverActivityStatus) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true, status: true, activityStatus: true },
    });

    if (!driverProfile) {
      throw new NotFoundException('Driver profile not found');
    }

    // Vérifier que le chauffeur est approuvé
    if (driverProfile.status !== 'APPROVED') {
      throw new BadRequestException('Seuls les chauffeurs approuvés peuvent changer leur statut');
    }

    const updated = await this.prisma.driverProfile.update({
      where: { id: driverProfile.id },
      data: { activityStatus: status },
      select: { 
        id: true, 
        status: true, 
        activityStatus: true,
        totalRides: true,
        rating: true,
        totalEarnings: true,
        user: { 
          select: { 
            id: true, 
            firstName: true,
            lastName: true 
          } 
        },
        vehicles: {
          where: { verified: true },
        }
      }
    });

    console.log(`✅ Driver ${userId} changed activity status to ${status}`);

    return {
      message: `Status changed to ${status}`,
      activityStatus: updated.activityStatus,
      driver: updated,
    };
  }

  /**
   * Récupérer le statut actuel du chauffeur
   */
  async getDriverStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        driverProfile: {
          include: {
            vehicles: {
              where: {
                verified: true,
              },
            },
          },
        },
      },
    });

    if (!user || !user.driverProfile) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    return {
      activityStatus: user.driverProfile.activityStatus,
      status: user.driverProfile.status,
      totalRides: user.driverProfile.totalRides,
      rating: user.driverProfile.rating,
      totalEarnings: user.driverProfile.totalEarnings,
      vehicles: user.driverProfile.vehicles,
    };
  }

  /**
   * Courses REQUESTED disponibles pour ce chauffeur (polling fallback)
   */
  async getAvailableRides(userId: string) {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true, status: true, activityStatus: true },
    });

    if (!driverProfile || driverProfile.status !== 'APPROVED' || driverProfile.activityStatus !== 'ONLINE') {
      return { rides: [], count: 0 };
    }

    const since = new Date(Date.now() - 10 * 60 * 1000);
    const rides = await this.prisma.ride.findMany({
      where: { status: 'REQUESTED', driverId: null, createdAt: { gte: since } },
      include: {
        client: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      rides: rides.map(r => ({
        rideId: r.id,
        id: r.id,
        clientName: `${r.client.user.firstName} ${r.client.user.lastName}`,
        clientPhone: r.client.user.phone,
        pickupAddress: r.pickupAddress,
        destinationAddress: r.destinationAddress,
        pickupLatitude: r.pickupLatitude,
        pickupLongitude: r.pickupLongitude,
        destinationLatitude: r.destinationLatitude,
        destinationLongitude: r.destinationLongitude,
        totalFare: r.totalFare,
        baseFare: r.baseFare,
        amount: r.totalFare,
        distanceKm: r.distanceKm,
        durationMinutes: r.durationMinutes ?? 0,
        passengerCount: r.passengerCount,
        rideType: r.rideType,
        notes: r.notes,
        status: r.status,
        requestedAt: r.requestedAt,
      })),
      count: rides.length,
    };
  }

  /**
   * Récupérer tous les chauffeurs en attente
   */
  async getPendingDrivers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [drivers, total] = await Promise.all([
      this.prisma.driverProfile.findMany({
        where: {
          status: 'PENDING',
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              city: true,
              country: true,
              createdAt: true,
            },
          },
          documents: {
            select: {
              id: true,
              docType: true,
              status: true,
              fileUrl: true,
              expiresAt: true,
              createdAt: true,
            },
          },
          vehicles: {
            select: {
              id: true,
              plateNumber: true,
              brand: true,
              model: true,
              color: true,
              year: true,
              capacity: true,
              verified: true,
              status: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.driverProfile.count({
        where: { status: 'PENDING' },
      }),
    ]);

    return {
      drivers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Récupérer tous les chauffeurs avec filtres
   */
  async getAllDrivers(params: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }) {
    const { page = 1, limit = 20, status, search } = params;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      };
    }

    const [drivers, total] = await Promise.all([
      this.prisma.driverProfile.findMany({
        where,
        include: {
          user: true,
          vehicles: true,
          documents: true,
        },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.driverProfile.count({ where }),
    ]);

    return {
      drivers,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Approuver un chauffeur
   */
  async approveDriver(driverId: string, adminId: string, message?: string) {
    console.log('🔍 Recherche du chauffeur:', driverId);

    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: {
        user: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Chauffeur introuvable');
    }

    console.log('✅ Chauffeur trouvé:', driver.user.email);

    if (driver.status === 'APPROVED') {
      throw new BadRequestException('Ce chauffeur est déjà approuvé');
    }

    const oldStatus = driver.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.driverProfile.update({
        where: { id: driverId },
        data: {
          status: 'APPROVED',
        },
      });

      await tx.adminLog.create({
        data: {
          adminId: adminId,
          action: 'APPROVE_DRIVER',
          resource: 'DRIVER',
          resourceId: driverId,
          oldValues: {
            status: oldStatus,
          },
          newValues: {
            status: 'APPROVED',
            approvedAt: new Date().toISOString(),
            message: message || null,
          },
          ipAddress: null,
          userAgent: null,
        },
      });
    });

    console.log('✅ Statut mis à jour en base de données');

    try {
      console.log('📧 Envoi de l\'email d\'approbation à:', driver.user.email);
      
      await this.emailService.sendDriverApprovalEmail(
        driver.user.email,
        driver.user.firstName,
        driver.user.lastName
      );
      
      console.log(' Email d\'approbation envoyé avec succès');
    } catch (emailError) {
      console.error(' Erreur lors de l\'envoi de l\'email:', emailError);
    }

    return {
      success: true,
      message: 'Chauffeur approuvé avec succès',
    };
  }

  /**
   * Rejeter un chauffeur
   */
  async rejectDriver(driverId: string, adminId: string, reason?: string) {
    console.log('🔍 Recherche du chauffeur pour rejet:', driverId);

    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: {
        user: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Chauffeur introuvable');
    }

    console.log('✅ Chauffeur trouvé:', driver.user.email);

    if (driver.status === 'REJECTED') {
      throw new BadRequestException('Ce chauffeur est déjà rejeté');
    }

    const oldStatus = driver.status;

    await this.prisma.$transaction(async (tx) => {
      await tx.driverProfile.update({
        where: { id: driverId },
        data: {
          status: 'REJECTED',
        },
      });

      await tx.adminLog.create({
        data: {
          adminId: adminId,
          action: 'REJECT_DRIVER',
          resource: 'DRIVER',
          resourceId: driverId,
          oldValues: {
            status: oldStatus,
          },
          newValues: {
            status: 'REJECTED',
            rejectedAt: new Date().toISOString(),
            reason: reason || null,
          },
          ipAddress: null,
          userAgent: null,
        },
      });
    });

    console.log(' Statut mis à jour en base de données');

    try {
      console.log(' Envoi de l\'email de rejet à:', driver.user.email);
      
      await this.emailService.sendDriverRejectionEmail(
        driver.user.email,
        driver.user.firstName,
        driver.user.lastName,
        reason
      );
      
      console.log(' Email de rejet envoyé avec succès');
    } catch (emailError) {
      console.error(' Erreur lors de l\'envoi de l\'email:', emailError);
    }

    return {
      success: true,
      message: 'Chauffeur rejeté',
    };
  }

  /**
   * Récupérer les détails d'un chauffeur
   */
  async getDriverDetails(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: {
        user: true,
        documents: true,
        vehicles: true,
        rides: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Chauffeur introuvable');
    }

    return driver;
  }

  /**
   * Supprimer un chauffeur
   */
  async deleteDriver(driverId: string, adminId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) {
      throw new NotFoundException('Chauffeur introuvable');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({
        where: { id: driver.userId },
      });

      await tx.adminLog.create({
        data: {
          adminId: adminId,
          action: 'DELETE_DRIVER',
          resource: 'DRIVER',
          resourceId: driverId,
          oldValues: {
            userId: driver.userId,
            email: driver.user.email,
            firstName: driver.user.firstName,
            lastName: driver.user.lastName,
            status: driver.status,
          },
          newValues: {
            deleted: true,
            deletedAt: new Date().toISOString(),
          },
          ipAddress: null,
          userAgent: null,
        },
      });
    });

    return {
      success: true,
      message: 'Chauffeur supprimé avec succès',
    };
  }
}