import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TemplateService } from './template.service';
import { PushService } from './push.service';
import { EmailService } from './email.service';
import { SmsService } from './sms.service';
import {
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  Prisma
} from '@prisma/client';
import { 
  SendNotificationParams, 
  NotificationFilters, 
  INotificationService,
  
} from '../interfaces/notification.interface';

import { Notification as NotificationModel } from '@prisma/client';

@Injectable()
export class NotificationsService implements INotificationService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private templateService: TemplateService,
    private pushService: PushService,
    private emailService: EmailService,
    private smsService: SmsService
  ) {}

  /**
   * Envoie une notification à un utilisateur
   * @param params Paramètres de notification
   */
  async sendNotification(params: SendNotificationParams): Promise<void> {
    const { type, userId, channels, variables, metadata, priority, scheduleAt } = params;

    try {
      // 1. Vérifier que l'utilisateur existe
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new NotFoundException(`Utilisateur ${userId} non trouvé`);
      }

      // 2. Déterminer les canaux à utiliser
      const targetChannels = channels || await this.getUserPreferredChannels(userId, type);

      // 3. Créer et envoyer pour chaque canal
      for (const channel of targetChannels) {
        await this.createAndSendNotification({
          type,
          userId,
          channel,
          variables: variables || {},
          metadata: metadata || {},
          priority: priority || 1,
          scheduleAt,
          userEmail: user.email,
          userPhone: user.phone
        });
      }

      this.logger.log(` Notification ${type} envoyée à ${userId} sur ${targetChannels.length} canaux`);

    } catch (error) {
      this.logger.error(` Erreur envoi notification: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envoie des notifications en lot
   * @param notifications Liste de notifications à envoyer
   */
  async sendBulkNotifications(notifications: SendNotificationParams[]): Promise<void> {
    const results = await Promise.allSettled(
      notifications.map(notification => this.sendNotification(notification))
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failureCount = results.filter(r => r.status === 'rejected').length;

    this.logger.log(`📊 Envoi en lot: ${successCount} succès, ${failureCount} échecs sur ${notifications.length}`);
  }

  /**
   * Récupère les notifications d'un utilisateur
   * @param userId ID utilisateur
   * @param filters Filtres de recherche
   * @returns Liste des notifications
   * Récupère les notifications d'un utilisateur
   * @param userId ID utilisateur
   * @param filters Filtres de recherche
   * @returns Liste des notifications
   */

 

  async getNotifications(userId: string, filters?: NotificationFilters): Promise<NotificationModel[]> {

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(filters?.status && { status: filters.status }),
      ...(filters?.type && { type: filters.type }),
      ...(filters?.channel && { channel: filters.channel }),
      ...(filters?.dateFrom && filters?.dateTo && {
        createdAt: {
          gte: new Date(filters.dateFrom),
          lte: new Date(filters.dateTo)
        }
      })
    };

    return this.prisma.notification.findMany({
      where,
      
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'desc' }
      ],
      take: filters?.limit || 20,
      skip: filters?.offset || 0
    });
  }

  /**
   * Marque une notification comme lue
   * @param notificationId ID notification
   * @param userId ID utilisateur (sécurité)
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
        status: { not: NotificationStatus.READ }
      },
      data: {
        status: NotificationStatus.READ,
        readAt: new Date()
      }
    });
  }

  /**
   * Relance les notifications échouées
   */
  async retryFailedNotifications(): Promise<void> {
    const failedNotifications = await this.prisma.notification.findMany({
      where: {
        status: NotificationStatus.FAILED,
        attempts: { lt: this.prisma.notification.fields.maxAttempts },
        OR: [
          { nextRetry: null },
          { nextRetry: { lte: new Date() } }
        ]
      },
      include: { user: true, template: true },
      take: 50 // Limiter pour éviter surcharge
    });

    this.logger.log(`🔄 Retry de ${failedNotifications.length} notifications échouées`);

    for (const notification of failedNotifications) {
      await this.retryNotification(notification);
    }
  }


  // =======================================================
  // MÉTHODES PRIVÉES
  // =======================================================

  private async getUserPreferredChannels(
    userId: string, 
    type: NotificationType
  ): Promise<NotificationChannel[]> {
    const preferences = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_type: { userId, type }
      }
    });

    if (!preferences) {
      // Valeurs par défaut si pas de préférences définies
      return [NotificationChannel.PUSH, NotificationChannel.IN_APP];
    }

    const channels: NotificationChannel[] = [];
    if (preferences.pushEnabled) channels.push(NotificationChannel.PUSH);
    if (preferences.emailEnabled) channels.push(NotificationChannel.EMAIL);
    if (preferences.smsEnabled) channels.push(NotificationChannel.SMS);
    if (preferences.inAppEnabled) channels.push(NotificationChannel.IN_APP);

    return channels;
  }

  private async createAndSendNotification(params: {
    type: NotificationType;
    userId: string;
    channel: NotificationChannel;
    variables: Record<string, any>;
    metadata: Record<string, any>;
    priority: number;
    scheduleAt?: Date;
    userEmail: string;
    userPhone: string;
  }) {
    const { type, userId, channel, variables, metadata, priority, scheduleAt, userEmail, userPhone } = params;

    try {
      // 1. Récupérer le template
      const template = await this.templateService.getTemplate(type, channel);

      // 2. Générer le contenu final
      const content = this.templateService.generateContent(template, variables);

      // 3. Créer l'enregistrement notification
      const notification = await this.prisma.notification.create({
        data: {
          templateId: template.id,
          userId,
          type,
          channel,
          title: content.title,
          body: content.body,
          subject: content.subject,
          status: scheduleAt ? NotificationStatus.PENDING : NotificationStatus.PENDING,
          priority,
          metadata,
          // TODO: Gérer scheduleAt pour notifications programmées
        }
      });

      // 4. Envoyer immédiatement si pas de programmation
      if (!scheduleAt) {
        await this.sendNotificationNow(notification.id, channel, content, userEmail, userPhone);
      }

    } catch (error) {
      this.logger.error(`Erreur création notification ${type}/${channel}: ${error.message}`);
      throw error;
    }
  }

  private async sendNotificationNow(
    notificationId: string,
    channel: NotificationChannel,
    content: { title: string; body: string; subject?: string },
    userEmail: string,
    userPhone: string
  ): Promise<void> {
    let success = false;

    try {
      // Envoyer selon le canal
      switch (channel) {
        case NotificationChannel.PUSH:
          success = await this.pushService.sendPushNotification(
            notificationId, 
            content.title, 
            content.body
          );
          break;

        case NotificationChannel.EMAIL:
          if (content.subject) {
            success = await this.emailService.sendEmail(
              notificationId,
              userEmail,
              content.subject,
              content.body
            );
          }
          break;

        case NotificationChannel.SMS:
          success = await this.smsService.sendSms(
            notificationId,
            userPhone,
            content.body
          );
          break;

        case NotificationChannel.IN_APP:
          // Les notifications in-app sont juste stockées en base
          success = true;
          break;
      }

      // Mettre à jour le statut
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: success ? NotificationStatus.SENT : NotificationStatus.FAILED,
          sentAt: success ? new Date() : undefined,
          attempts: { increment: 1 },
          errorMsg: success ? null : 'Échec envoi',
          nextRetry: success ? null : new Date(Date.now() + 5 * 60 * 1000) // Retry dans 5min
        }
      });

    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          attempts: { increment: 1 },
          errorMsg: error.message,
          nextRetry: new Date(Date.now() + 5 * 60 * 1000)
        }
      });
    }
  }

  private async retryNotification(notification: any): Promise<void> {
    await this.sendNotificationNow(
      notification.id,
      notification.channel,
      {
        title: notification.title,
        body: notification.body,
        subject: notification.subject
      },
      notification.user.email,
      notification.user.phone
    );
  }
}