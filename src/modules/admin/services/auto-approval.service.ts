import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { 
  DriverStatus, 
  DocumentStatus, 
  VehicleStatus,
  UserRole 
} from '@prisma/client';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class AutoApprovalService {
  private readonly logger = new Logger(AutoApprovalService.name);
  private readonly AUTO_APPROVE = process.env.AUTO_APPROVE === 'true' || process.env.NODE_ENV === 'development';

  constructor(private prisma: PrismaService) {}

  // ===============================
  // MÉTHODE PRINCIPALE D'AUTO-APPROBATION
  // ===============================
  async autoApproveAll() {
    if (!this.AUTO_APPROVE) {
      this.logger.log('Auto-approval disabled in production');
      return;
    }

    this.logger.log('🚀 Starting auto-approval process...');

    const results = await this.prisma.$transaction(async (tx) => {
      // 1. Approuver tous les chauffeurs en attente
      const drivers = await tx.driverProfile.updateMany({
        where: { status: DriverStatus.PENDING },
        data: { status: DriverStatus.APPROVED }
      });

      // 2. Approuver tous les documents en attente
      const documents = await tx.driverDocument.updateMany({
        where: { status: DocumentStatus.PENDING },
        data: { 
          status: DocumentStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: 'AUTO_APPROVAL_SYSTEM'
        }
      });

      // 3. Vérifier tous les véhicules non vérifiés
      const vehicles = await tx.vehicle.updateMany({
        where: { verified: false },
        data: { 
          verified: true,
          verifiedAt: new Date(),
          status: VehicleStatus.AVAILABLE
        }
      });

      return { drivers, documents, vehicles };
    });

    this.logger.log(`✅ Auto-approval completed:
      - ${results.drivers.count} drivers approved
      - ${results.documents.count} documents approved
      - ${results.vehicles.count} vehicles verified`);

    return results;
  }

  // ===============================
  // APPROBATION D'UN CHAUFFEUR SPÉCIFIQUE
  // ===============================
  async approveDriver(driverId: string, autoApprove = this.AUTO_APPROVE) {
    if (!autoApprove) {
      this.logger.log(`Manual approval required for driver ${driverId}`);
      return null;
    }

    const driver = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { status: DriverStatus.APPROVED },
      include: {
        user: true,
        documents: true,
        vehicles: true
      }
    });

    // Approuver aussi ses documents et véhicules
    await this.prisma.$transaction([
      this.prisma.driverDocument.updateMany({
        where: { 
          driverId: driverId,
          status: DocumentStatus.PENDING 
        },
        data: { 
          status: DocumentStatus.APPROVED,
          reviewedAt: new Date(),
          reviewedBy: 'AUTO_APPROVAL_SYSTEM'
        }
      }),
      this.prisma.vehicle.updateMany({
        where: { 
          driverId: driverId,
          verified: false 
        },
        data: { 
          verified: true,
          verifiedAt: new Date(),
          status: VehicleStatus.AVAILABLE
        }
      })
    ]);

    this.logger.log(`✅ Driver ${driverId} fully approved with documents and vehicles`);
    return driver;
  }

  // ===============================
  // APPROBATION D'UN DOCUMENT SPÉCIFIQUE
  // ===============================
  async approveDocument(documentId: string, autoApprove = this.AUTO_APPROVE) {
    if (!autoApprove) {
      this.logger.log(`Manual approval required for document ${documentId}`);
      return null;
    }

    const document = await this.prisma.driverDocument.update({
      where: { id: documentId },
      data: { 
        status: DocumentStatus.APPROVED,
        reviewedAt: new Date(),
        reviewedBy: 'AUTO_APPROVAL_SYSTEM'
      }
    });

    this.logger.log(` Document ${documentId} approved`);
    return document;
  }

  // ===============================
  // VÉRIFICATION D'UN VÉHICULE SPÉCIFIQUE
  // ===============================
  async verifyVehicle(vehicleId: string, autoApprove = this.AUTO_APPROVE) {
    if (!autoApprove) {
      this.logger.log(`Manual verification required for vehicle ${vehicleId}`);
      return null;
    }

    const vehicle = await this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { 
        verified: true,
        verifiedAt: new Date(),
        status: VehicleStatus.AVAILABLE
      }
    });

    this.logger.log(`✅ Vehicle ${vehicleId} verified and available`);
    return vehicle;
  }
}