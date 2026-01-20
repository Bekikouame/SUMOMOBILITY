// src/modules/admin/services/auto-approval.service.ts

import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmailService } from '../../email/email.service';

@Injectable()
export class AutoApprovalService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // ✅ MÉTHODE 1 : Approuver + Email
  async approveDriverWithEmail(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true, vehicles: true }
    });

    if (!driver) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    if (driver.status === 'APPROVED') {
      throw new ConflictException('Ce chauffeur est déjà approuvé');
    }

    // ✅ Enlever approvedAt
    const updatedDriver = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { 
        status: 'APPROVED',
      },
      include: { user: true, vehicles: true }
    });

    // Vérifier les véhicules
    if (driver.vehicles && driver.vehicles.length > 0) {
      await Promise.all(
        driver.vehicles.map(vehicle =>
          this.prisma.vehicle.update({
            where: { id: vehicle.id },
            data: { 
              verified: true,
              verifiedAt: new Date() // ✅ Ce champ existe dans Vehicle
            }
          })
        )
      );
    }

    // Envoyer l'email
    let emailSent = false;
    try {
      await this.emailService.sendDriverApprovalEmail(
        driver.user.email,
        driver.user.firstName,
        driver.user.lastName
      );
      emailSent = true;
      console.log('✅ Email envoyé à:', driver.user.email);
    } catch (error) {
      console.error('⚠️ Erreur envoi email:', error);
    }

    return {
      driver: updatedDriver,
      emailSent
    };
  }

  // ✅ MÉTHODE 2 : Rejeter + Email
  async rejectDriverWithEmail(driverId: string, reason?: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true }
    });

    if (!driver) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    if (driver.status === 'REJECTED') {
      throw new ConflictException('Ce chauffeur est déjà rejeté');
    }

    // ✅ Enlever rejectedAt
    const updatedDriver = await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { 
        status: 'REJECTED',
      },
      include: { user: true }
    });

    let emailSent = false;
    try {
      await this.emailService.sendDriverRejectionEmail(
        driver.user.email,
        driver.user.firstName,
        driver.user.lastName,
        reason
      );
      emailSent = true;
      console.log('✅ Email de rejet envoyé à:', driver.user.email);
    } catch (error) {
      console.error('⚠️ Erreur envoi email:', error);
    }

    return {
      driver: updatedDriver,
      emailSent
    };
  }

  // ✅ MÉTHODE 3 : Approuver simple
  async approveDriver(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true, vehicles: true }
    });

    if (!driver) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    return this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { 
        status: 'APPROVED',
      },
      include: { user: true, vehicles: true }
    });
  }

  // ✅ MÉTHODE 4 : Vérifier véhicule
  async verifyVehicle(vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId }
    });

    if (!vehicle) {
      throw new NotFoundException('Véhicule non trouvé');
    }

    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: { 
        verified: true,
        verifiedAt: new Date()
      },
      include: {
        driver: {
          include: { user: true }
        }
      }
    });
  }

 
// ✅ MÉTHODE 5 : Auto-approuver tout + emails
async autoApproveAll() {
  const pendingDrivers = await this.prisma.driverProfile.findMany({
    where: { status: 'PENDING' },
    include: { user: true, vehicles: true },
  });

  let driversApproved = 0; 
  const emailResults: { email: string; sent: boolean }[] = [];

  for (const driver of pendingDrivers) {
    // 1) Mettre le driver en APPROVED
    const updatedDriver = await this.prisma.driverProfile.update({
      where: { id: driver.id },
      data: {
        status: 'APPROVED',
      },
      include: { user: true, vehicles: true },
    });

    driversApproved++; 
    // 2) Vérifier tous ses véhicules
    if (driver.vehicles && driver.vehicles.length > 0) {
      await Promise.all(
        driver.vehicles.map((vehicle) =>
          this.prisma.vehicle.update({
            where: { id: vehicle.id },
            data: {
              verified: true,
              verifiedAt: new Date(),
            },
          }),
        ),
      );
    }

    // 3) Tenter l’envoi de l’email
    let sent = false;
    try {
      await this.emailService.sendDriverApprovalEmail(
        driver.user.email,
        driver.user.firstName,
        driver.user.lastName,
      );
      sent = true;
      console.log(' Email auto-approve envoyé à :', driver.user.email);
    } catch (error) {
      console.error('Erreur envoi email auto-approve :', error);
    }

    emailResults.push({ email: driver.user.email, sent });
  }

  return {
    message: 'Approbations automatiques effectuées',
    driversApproved,      
    emails: emailResults,
  };
}


}