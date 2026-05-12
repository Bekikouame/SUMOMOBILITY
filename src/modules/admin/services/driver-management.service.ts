// src/modules/admin/services/driver-management.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DriverStatus, DocumentStatus, Prisma } from '@prisma/client';
import { ApproveDriverDto, RejectDriverDto } from '../dto/driver-management.dto';
import { EmailService } from '../../email/email.service';
import { AdminLogService } from './admin-log.service'; 
import { FileUploadService } from '../../../documents/service/file-upload.service'; 
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class DriverManagementService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private adminLogService: AdminLogService, // ✅ CORRECTION
    private fileUploadService: FileUploadService, // ✅ CORRECTION
  ) {}

  async getAllDrivers(
    page: number = 1,
    limit: number = 20,
    status?: string,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.DriverProfileWhereInput = {};

    if (status && this.isValidDriverStatus(status)) {
      where.status = status as DriverStatus;
    }

    if (search && search.trim().length > 0) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [drivers, total] = await Promise.all([
      this.prisma.driverProfile.findMany({
        where,
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
              expiresAt: true,
            },
          },
          vehicles: {
            select: {
              id: true,
              plateNumber: true,
              brand: true,
              model: true,
              verified: true,
            },
          },
          _count: {
            select: {
              rides: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.driverProfile.count({ where }),
    ]);

    return {
      drivers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getPendingDrivers(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [drivers, total] = await Promise.all([
      this.prisma.driverProfile.findMany({
        where: {
          status: DriverStatus.PENDING,
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
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.driverProfile.count({
        where: { status: DriverStatus.PENDING },
      }),
    ]);

    return {
      drivers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getDriverDetails(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: {
        user: true,
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        vehicles: {
          include: {
            _count: {
              select: { rides: true },
            },
          },
        },
        rides: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            status: true,
            totalFare: true,
            driverEarnings: true,
            createdAt: true,
            pickupAddress: true,
            destinationAddress: true,
          },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Chauffeur non trouvé');
    }

    const REQUIRED_DOCS = ['DRIVER_LICENSE', 'IDENTITY_CARD', 'VEHICLE_REGISTRATION', 'INSURANCE'];
    const existingDocTypes = driver.documents.map(d => d.docType);
    const missingDocs = REQUIRED_DOCS.filter(type => !existingDocTypes.includes(type));

    return {
      ...driver,
      missingDocuments: missingDocs,
      documentProgress: {
        total: REQUIRED_DOCS.length,
        submitted: existingDocTypes.length,
        approved: driver.documents.filter(d => d.status === DocumentStatus.APPROVED).length,
      },
    };
  }

  async getDriverDocuments(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Chauffeur non trouvé');
    }

    return driver.documents;
  }

  async getDriverVehicle(driverId: string) {
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { driverId },
      include: {
        driver: {
          include: {
            user: true,
          },
        },
      },
    });

    if (!vehicle) {
      throw new NotFoundException('Aucun véhicule trouvé pour ce chauffeur');
    }

    return vehicle;
  }

  async approveDriver(driverId: string, dto: ApproveDriverDto) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true, documents: true },
    });

    if (!driver) {
      throw new NotFoundException('Chauffeur non trouvé');
    }

    // Approuver automatiquement tous les documents PENDING du chauffeur
    if (driver.documents.length > 0) {
      await this.prisma.driverDocument.updateMany({
        where: {
          driverId,
          status: { in: [DocumentStatus.PENDING, DocumentStatus.REJECTED] },
        },
        data: { status: DocumentStatus.APPROVED },
      });
    }

    // Vérifier automatiquement tous les véhicules du chauffeur
    await this.prisma.vehicle.updateMany({
      where: { driverId },
      data: { verified: true, status: 'AVAILABLE' },
    });

    const updatedDriver = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { status: DriverStatus.APPROVED },
      include: { user: true },
    });

    await this.emailService.sendDriverApprovalEmail(
      driver.user.email ?? '',
      `${driver.user.firstName} ${driver.user.lastName}`,
      dto.message || 'Félicitations ! Votre compte a été approuvé.',
    );

    return {
      success: true,
      message: 'Chauffeur approuvé avec succès',
      driver: updatedDriver,
    };
  }

  async verifyDriverVehicles(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Chauffeur non trouvé');

    const result = await this.prisma.vehicle.updateMany({
      where: { driverId },
      data: { verified: true, status: 'AVAILABLE' },
    });

    return {
      success: true,
      message: `${result.count} véhicule(s) vérifié(s)`,
    };
  }

  async rejectDriver(driverId: string, dto: RejectDriverDto) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) {
      throw new NotFoundException('Chauffeur non trouvé');
    }

    const updatedDriver = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        status: DriverStatus.REJECTED,
      },
      include: {
        user: true,
      },
    });

    await this.emailService.sendDriverRejectionEmail(
      driver.user.email ?? '',
      `${driver.user.firstName} ${driver.user.lastName}`,
      dto.reason,
    );

    return {
      success: true,
      message: 'Chauffeur rejeté',
      driver: updatedDriver,
    };
  }

  async suspendDriver(driverId: string) {
    const driver = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { status: DriverStatus.SUSPENDED },
      include: { user: true },
    });

    return {
      success: true,
      message: 'Chauffeur suspendu',
      driver,
    };
  }

  async activateDriver(driverId: string) {
    const driver = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { status: DriverStatus.APPROVED },
      include: { user: true },
    });

    return {
      success: true,
      message: 'Chauffeur réactivé',
      driver,
    };
  }

  async getStatistics() {
    const [
      total,
      pending,
      approved,
      rejected,
      suspended,
      avgRating,
      totalRides,
      totalEarnings,
    ] = await Promise.all([
      this.prisma.driverProfile.count(),
      this.prisma.driverProfile.count({ where: { status: DriverStatus.PENDING } }),
      this.prisma.driverProfile.count({ where: { status: DriverStatus.APPROVED } }),
      this.prisma.driverProfile.count({ where: { status: DriverStatus.REJECTED } }),
      this.prisma.driverProfile.count({ where: { status: DriverStatus.SUSPENDED } }),
      this.prisma.driverProfile.aggregate({
        _avg: { rating: true },
      }),
      this.prisma.driverProfile.aggregate({
        _sum: { totalRides: true },
      }),
      this.prisma.driverProfile.aggregate({
        _sum: { totalEarnings: true },
      }),
    ]);

    return {
      total,
      pending,
      approved,
      rejected,
      suspended,
      avgRating: avgRating._avg.rating || 0,
      totalRides: totalRides._sum.totalRides || 0,
      totalEarnings: totalEarnings._sum.totalEarnings || 0,
      approvalRate: total > 0 ? ((approved / total) * 100).toFixed(1) : 0,
    };
  }

  // ✅ MÉTHODE DE SUPPRESSION
  async deleteDriver(driverId: string, adminId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: {
        user: true,
        documents: true,
        vehicles: true,
      },
    });

    if (!driver) {
      throw new NotFoundException('Chauffeur non trouvé');
    }

    // Vérifier qu'il n'y a pas de courses en cours
    const activeRides = await this.prisma.ride.count({
      where: {
        driverId,
        status: {
          in: ['REQUESTED', 'ACCEPTED', 'IN_PROGRESS'],
        },
      },
    });

    if (activeRides > 0) {
      throw new BadRequestException(
        'Impossible de supprimer un chauffeur avec des courses en cours'
      );
    }

    // Supprimer les fichiers des documents
    for (const doc of driver.documents) {
      if (doc.fileUrl) {
        try {
          await this.deleteFile(doc.fileUrl);
        } catch (error) {
          console.error(`Erreur suppression fichier ${doc.fileUrl}:`, error);
        }
      }
    }

    // Supprimer le dossier du chauffeur
    try {
      await this.deleteDriverFolder(driverId);
    } catch (error) {
      console.error(`Erreur suppression dossier ${driverId}:`, error);
    }

    // Tout supprimer en cascade dans une transaction
    await this.prisma.$transaction(async (tx) => {
      // 1. Supprimer les documents
      await tx.driverDocument.deleteMany({
        where: { driverId },
      });

      // 2. Supprimer les véhicules
      await tx.vehicle.deleteMany({
        where: { driverId },
      });

      // 3. Supprimer les courses (historique)
      await tx.ride.deleteMany({
        where: { driverId },
      });

      // 4. Supprimer la localisation (si existe)
      await tx.driverLocation.deleteMany({
        where: { driverId },
      });

      // 5. Supprimer les notifications
      await tx.notification.deleteMany({
        where: { userId: driver.userId },
      });

      // 6. Supprimer les préférences de notification
      await tx.notificationPreference.deleteMany({
        where: { userId: driver.userId },
      });

      // 7. Supprimer le profil chauffeur
      await tx.driverProfile.delete({
        where: { id: driverId },
      });

      // 8. Supprimer l'utilisateur
      await tx.user.delete({
        where: { id: driver.userId },
      });
    });

    // ✅ Log de l'action
    await this.adminLogService.log(adminId, {
      action: 'DELETE_DRIVER',
      resource: 'DRIVER',
      resourceId: driverId,
      oldValues: {
        driverName: `${driver.user.firstName} ${driver.user.lastName}`,
        email: driver.user.email,
        phone: driver.user.phone,
        documentsCount: driver.documents.length,
        vehiclesCount: driver.vehicles.length,
      },
    });

    return {
      success: true,
      message: `Chauffeur ${driver.user.firstName} ${driver.user.lastName} supprimé avec succès`,
    };
  }

  // ✅ MÉTHODES PRIVÉES POUR SUPPRESSION DE FICHIERS
  private async deleteFile(fileUrl: string): Promise<void> {
    try {
      let filePath: string;

      if (fileUrl.startsWith('http')) {
        const url = new URL(fileUrl);
        const relativePath = url.pathname.replace('/uploads/', '');
        filePath = path.join(process.cwd(), 'uploads', relativePath);
      } else {
        filePath = path.join(process.cwd(), fileUrl);
      }

      await fs.access(filePath);
      await fs.unlink(filePath);
      console.log(`✅ Fichier supprimé: ${filePath}`);
    } catch (error) {
      console.error(`❌ Erreur suppression fichier:`, error);
    }
  }

  private async deleteDriverFolder(driverId: string): Promise<void> {
    try {
      const folderPath = path.join(process.cwd(), 'uploads', 'documents', driverId);

      try {
        await fs.access(folderPath);
      } catch {
        console.log(`ℹ️ Dossier ${driverId} n'existe pas`);
        return;
      }

      await fs.rm(folderPath, { recursive: true, force: true });
      console.log(`✅ Dossier supprimé: ${folderPath}`);
    } catch (error) {
      console.error(`❌ Erreur suppression dossier:`, error);
    }
  }

  private isValidDriverStatus(status: string): status is DriverStatus {
    return Object.values(DriverStatus).includes(status as DriverStatus);
  }
}