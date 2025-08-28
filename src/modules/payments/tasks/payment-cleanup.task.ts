// src/payments/tasks/payment-cleanup.task.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Injectable()
export class PaymentCleanupTask {
  constructor(private prisma: PrismaService) {}

  // Nettoie les paiements en attente depuis plus de 30 minutes
  @Cron(CronExpression.EVERY_10_MINUTES)
  async cleanupPendingPayments() {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const expiredPayments = await this.prisma.payment.updateMany({
      where: {
        status: PaymentStatus.PENDING,
        createdAt: {
          lt: thirtyMinutesAgo,
        },
      },
      data: {
        status: PaymentStatus.FAILED,
        failureReason: 'Timeout - Paiement non traité dans les délais',
        processedAt: new Date(),
      },
    });

    if (expiredPayments.count > 0) {
      console.log(`🧹 Nettoyage: ${expiredPayments.count} paiements expirés marqués comme échoués`);
    }
  }

  // Met à jour les statistiques des chauffeurs tous les jours à 02h00
  @Cron('0 2 * * *')
  async updateDriverEarningsStats() {
    const drivers = await this.prisma.driverProfile.findMany({
      select: { id: true },
    });

    for (const driver of drivers) {
      const stats = await this.prisma.ride.aggregate({
        where: {
          driverId: driver.id,
          status: 'COMPLETED',
          payments: {
            some: {
              payment: {
                status: PaymentStatus.SUCCEEDED,
              },
            },
          },
        },
        _count: true,
        _sum: {
          driverEarnings: true,
        },
        _avg: {
          driverEarnings: true,
        },
      });

      await this.prisma.driverProfile.update({
        where: { id: driver.id },
        data: {
          totalRides: stats._count,
          totalEarnings: stats._sum.driverEarnings || 0,
        },
      });
    }

    console.log(` Statistiques mises à jour pour ${drivers.length} chauffeurs`);
  }
}
