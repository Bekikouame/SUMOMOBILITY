import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationsService } from '../services/notifications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DocumentStatus } from '@prisma/client';

/**
 * Tâches planifiées pour notifications automatiques
 */
@Injectable()
export class NotificationTasks {
  private readonly logger = new Logger(NotificationTasks.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private eventEmitter: EventEmitter2
  ) {}

  /**
   * Vérifie les documents qui expirent bientôt (chaque jour à 9h)
   */
  @Cron('0 9 * * *')
  async checkExpiringDocuments() {
    this.logger.log('🔍 Vérification documents expirant...');

    // Documents qui expirent dans les 7 prochains jours
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    const expiringDocuments = await this.prisma.driverDocument.findMany({
      where: {
        status: DocumentStatus.APPROVED,
        expiresAt: {
          lte: sevenDaysFromNow,
          gt: new Date() // Pas encore expirés
        }
      },
      include: {
        driver: {
          include: {
            user: true
          }
        }
      }
    });

    this.logger.log(`📄 ${expiringDocuments.length} documents expirent bientôt`);

    // Envoyer notifications
    for (const document of expiringDocuments) {
      this.eventEmitter.emit('document.expiring', {
        driverId: document.driverId,
        userId: document.driver.userId,
        documentId: document.id,
        docType: document.docType,
        expirationDate: document.expiresAt?.toISOString().split('T')[0]
      });
    }
  }

  /**
   * Relance les notifications échouées (toutes les 10 minutes)
   */
  @Cron('*/10 * * * *')
  async retryFailedNotifications() {
    try {
      await this.notificationsService.retryFailedNotifications();
    } catch (error) {
      this.logger.error(`Erreur retry notifications: ${error.message}`);
    }
  }

  /**
   * Nettoie les anciennes notifications (chaque dimanche à 2h)
   */
  @Cron('0 2 * * 0')
  async cleanupOldNotifications() {
    this.logger.log('🧹 Nettoyage anciennes notifications...');

    // Supprimer notifications READ de plus de 30 jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const deleted = await this.prisma.notification.deleteMany({
      where: {
        status: 'READ',
        readAt: {
          lt: thirtyDaysAgo
        }
      }
    });

    this.logger.log(`🗑️ ${deleted.count} notifications supprimées`);
  }

  /**
   * Rappels pour réservations (toutes les heures)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async sendReservationReminders() {
    // Réservations dans 1 heure
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    
    const upcomingReservations = await this.prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        scheduledAt: {
          gte: new Date(),
          lte: oneHourFromNow
        }
      },
      include: {
        client: {
          include: {
            user: true
          }
        }
      }
    });

    this.logger.log(` ${upcomingReservations.length} rappels réservation à envoyer`);

    for (const reservation of upcomingReservations) {
      await this.notificationsService.sendNotification({
        type: 'RESERVATION_REMINDER',
        userId: reservation.client.userId,
        variables: {
          scheduledTime: reservation.scheduledAt.toLocaleTimeString('fr-FR'),
          pickup: reservation.pickupAddress,
          destination: reservation.destinationAddress
        },
        metadata: {
          reservationId: reservation.id
        }
      });
    }
  }
}