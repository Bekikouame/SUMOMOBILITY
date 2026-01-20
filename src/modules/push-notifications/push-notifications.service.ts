// src/modules/push-notifications/push-notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);
  private expo: Expo;

  constructor(private prisma: PrismaService) {
    this.expo = new Expo();
  }

  /**
   * Enregistrer le token push d'un utilisateur
   */
 async registerPushToken(userId: string, expoPushToken: string) {
  //  IGNORER les tokens de développement Expo Go
  if (expoPushToken === 'EXPO_GO_DEV_TOKEN' || !expoPushToken) {
    this.logger.warn(` Token de dev ignoré pour user ${userId} (Expo Go)`);
    return {
      success: true,
      message: 'Dev mode - notifications désactivées'
    };
  }

  //  Valider le format du token Expo
  if (!expoPushToken.startsWith('ExponentPushToken[') && !expoPushToken.startsWith('ExpoPushToken[')) {
    this.logger.log(` Token push invalide: ${expoPushToken}`);
    throw new Error(`Token push invalide: ${expoPushToken}`);
  }

  // Enregistrer le token dans la base de données
  try {
    await this.prisma.user.update({
      where: { id: userId },
      data: { expoPushToken },
    });

    this.logger.log(`✅ Token push enregistré pour user ${userId}`);
    return {
      success: true,
      message: 'Token push enregistré avec succès'
    };
  } catch (error) {
    this.logger.log(`❌ Erreur enregistrement token push:`, error);
    throw error;
  }
 }

  /**
   * Envoyer une notification push à un utilisateur
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    try {
      // Récupérer le token de l'utilisateur
      // @ts-ignore - Le champ expoPushToken existe après migration Prisma
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { expoPushToken: true },
      });

      if (!user?.expoPushToken) {
        this.logger.warn(` Pas de token push pour user ${userId}`);
        return;
      }

      await this.sendPushToToken(user.expoPushToken, title, body, data);
    } catch (error) {
      this.logger.log(` Erreur envoi notification push:`, error);
    }
  }

  /**
   * Envoyer une notification push à plusieurs utilisateurs
   */
  async sendPushToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    try {
      // Récupérer les tokens
      // @ts-ignore - Le champ expoPushToken existe après migration Prisma
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: userIds },
          expoPushToken: { not: null },
        },
        select: { expoPushToken: true },
      });

      const tokens = users
        .map((u) => u.expoPushToken)
        .filter((token): token is string => !!token);

      if (tokens.length === 0) {
        this.logger.warn(` Aucun token push disponible pour les utilisateurs`);
        return;
      }

      await this.sendPushToTokens(tokens, title, body, data);
    } catch (error) {
      this.logger.log(` Erreur envoi notifications multiples:`, error);
    }
  }

  /**
   * Envoyer une notification push à tous les chauffeurs en ligne
   */
  async sendPushToOnlineDrivers(
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    try {
      // Récupérer les chauffeurs en ligne
      // @ts-ignore - Le champ expoPushToken existe après migration Prisma
      const drivers = await this.prisma.driverProfile.findMany({
        where: {
          activityStatus: 'ONLINE',
          user: {
            expoPushToken: { not: null },
          },
        },
        select: {
          user: {
            select: { expoPushToken: true },
          },
        },
      });

      const tokens = drivers
        .map((d) => d.user.expoPushToken)
        .filter((token): token is string => !!token);

      if (tokens.length === 0) {
        this.logger.warn(` Aucun chauffeur en ligne avec token push`);
        return;
      }

      this.logger.log(` Envoi notification à ${tokens.length} chauffeurs en ligne`);
      await this.sendPushToTokens(tokens, title, body, data);
    } catch (error) {
      this.logger.log(` Erreur envoi aux chauffeurs en ligne:`, error);
    }
  }

  /**
   * Envoyer une notification à un token spécifique
   */
  private async sendPushToToken(
    token: string,
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    await this.sendPushToTokens([token], title, body, data);
  }

  /**
   * Envoyer des notifications à plusieurs tokens
   */
  private async sendPushToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: any,
  ): Promise<void> {
    try {
      // Créer les messages
      const messages: ExpoPushMessage[] = tokens.map((token) => ({
        to: token,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high',
      }));

      // Diviser en chunks (Expo limite à 100 notifications par requête)
      const chunks = this.expo.chunkPushNotifications(messages);

      // Envoyer chaque chunk
      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          this.logger.log(`✅ Chunk envoyé:`, ticketChunk);

          // Vérifier les erreurs
          ticketChunk.forEach((ticket, index) => {
            if (ticket.status === 'error') {
              this.logger.log(
                ` Erreur notification ${index}:`,
                ticket.message,
              );
            }
          });
        } catch (error) {
          this.logger.log(` Erreur envoi chunk:`, error);
        }
      }
    } catch (error) {
      this.logger.log(`Erreur création messages:`, error);
      throw error;
    }
  }

  /**
   * Envoyer une notification de nouvelle course aux chauffeurs
   */
  async notifyNewRide(
    rideId: string,
    clientName: string,
    pickupAddress: string,
    destinationAddress: string,
    fare: number,
  ): Promise<void> {
    await this.sendPushToOnlineDrivers(
      '🚗 Nouvelle course disponible',
      `${clientName} demande une course\nDe: ${pickupAddress}\nÀ: ${destinationAddress}\nPrix: ${fare} FCFA`,
      {
        type: 'NEW_RIDE',
        rideId,
        screen: 'DriverHome',
      },
    );
  }

  /**
   * Envoyer une notification de nouvelle réservation aux chauffeurs
   */
  async notifyNewReservation(
    reservationId: string,
    clientName: string,
    scheduledAt: Date,
    pickupAddress: string,
    destinationAddress: string,
    estimatedPrice: number,
  ): Promise<void> {
    const dateStr = scheduledAt.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const timeStr = scheduledAt.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

    await this.sendPushToOnlineDrivers(
      ' Nouvelle réservation',
      `${clientName} pour le ${dateStr} à ${timeStr}\nDe: ${pickupAddress}\nÀ: ${destinationAddress}\nPrix: ${estimatedPrice} FCFA`,
      {
        type: 'NEW_RESERVATION',
        reservationId,
        screen: 'DriverReservations',
      },
    );
  }

  /**
   * Notifier le client que sa course a été acceptée
   */
  async notifyRideAccepted(
    clientUserId: string,
    driverName: string,
    rideId: string,
  ): Promise<void> {
    await this.sendPushNotification(
      clientUserId,
      ' Course acceptée !',
      `${driverName} a accepté votre course et arrive bientôt`,
      {
        type: 'RIDE_ACCEPTED',
        rideId,
        screen: 'ClientRideTracking',
      },
    );
  }

  /**
   * Notifier le client que sa réservation a été acceptée
   */
  async notifyReservationAccepted(
    clientUserId: string,
    driverName: string,
    reservationId: string,
  ): Promise<void> {
    await this.sendPushNotification(
      clientUserId,
      ' Réservation confirmée !',
      `${driverName} a confirmé votre réservation`,
      {
        type: 'RESERVATION_ACCEPTED',
        reservationId,
        screen: 'ClientReservations',
      },
    );
  }

  /**
   * Notifier une nouvelle demande de covoiturage
   */
  async notifyNewCarpoolRequest(
    ownerUserId: string,
    requesterName: string,
    carpoolId: string,
  ): Promise<void> {
    await this.sendPushNotification(
      ownerUserId,
      ' Nouvelle demande de covoiturage',
      `${requesterName} souhaite rejoindre votre covoiturage`,
      {
        type: 'CARPOOL_REQUEST',
        carpoolId,
        screen: 'MyCarpools',
      },
    );
  }
}
