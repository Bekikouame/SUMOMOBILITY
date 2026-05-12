import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly firebase: FirebaseService,
  ) {}

  async registerPushToken(userId: string, fcmToken: string) {
    if (!fcmToken || fcmToken === 'EXPO_GO_DEV_TOKEN') {
      return { success: true, message: 'Dev mode - notifications désactivées' };
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { expoPushToken: fcmToken },
    });

    this.logger.log(`FCM token enregistré pour user ${userId}`);
    return { success: true, message: 'Token FCM enregistré' };
  }

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    // @ts-ignore
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { expoPushToken: true },
    });

    if (!user?.expoPushToken) {
      this.logger.warn(`Pas de token FCM pour user ${userId}`);
      return;
    }

    await this.firebase.sendToToken(user.expoPushToken, title, body, data);
  }

  async sendPushToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    // @ts-ignore
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, expoPushToken: { not: null } },
      select: { expoPushToken: true },
    });

    const tokens = users
      .map(u => u.expoPushToken)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) return;
    await this.firebase.sendToTokens(tokens, title, body, data);
  }

  async sendPushToOnlineDrivers(
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    // @ts-ignore
    const drivers = await this.prisma.driverProfile.findMany({
      where: {
        activityStatus: 'ONLINE',
        user: { expoPushToken: { not: null } },
      },
      select: { user: { select: { expoPushToken: true } } },
    });

    const tokens = drivers
      .map(d => d.user.expoPushToken)
      .filter((t): t is string => !!t);

    if (tokens.length === 0) {
      this.logger.warn('Aucun chauffeur en ligne avec token FCM');
      return;
    }

    this.logger.log(`FCM → ${tokens.length} chauffeurs en ligne`);
    await this.firebase.sendToTokens(tokens, title, body, data);
  }

  async notifyNewRide(
    rideId: string,
    clientName: string,
    pickupAddress: string,
    destinationAddress: string,
    fare: number,
  ): Promise<void> {
    await this.sendPushToOnlineDrivers(
      '🚗 Nouvelle course disponible',
      `${clientName} • De: ${pickupAddress} → ${destinationAddress} • ${fare} FCFA`,
      { type: 'NEW_RIDE', rideId, screen: 'DriverHome' },
    );
  }

  async notifyNewReservation(
    reservationId: string,
    clientName: string,
    scheduledAt: Date,
    pickupAddress: string,
    destinationAddress: string,
    estimatedPrice: number,
  ): Promise<void> {
    const dateStr = scheduledAt.toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const timeStr = scheduledAt.toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    });

    await this.sendPushToOnlineDrivers(
      '📅 Nouvelle réservation',
      `${clientName} • ${dateStr} à ${timeStr} • ${estimatedPrice} FCFA`,
      { type: 'NEW_RESERVATION', reservationId, screen: 'DriverReservations' },
    );
  }

  async notifyRideAccepted(
    clientUserId: string,
    driverName: string,
    rideId: string,
  ): Promise<void> {
    await this.sendPushNotification(
      clientUserId,
      '✅ Course acceptée !',
      `${driverName} arrive bientôt`,
      { type: 'RIDE_ACCEPTED', rideId, screen: 'ClientTrackingDriver' },
    );
  }

  async notifyReservationAccepted(
    clientUserId: string,
    driverName: string,
    reservationId: string,
  ): Promise<void> {
    await this.sendPushNotification(
      clientUserId,
      '✅ Réservation confirmée !',
      `${driverName} a confirmé votre réservation`,
      { type: 'RESERVATION_ACCEPTED', reservationId, screen: 'MyReservations' },
    );
  }

  async notifyNewCarpoolRequest(
    ownerUserId: string,
    requesterName: string,
    carpoolId: string,
  ): Promise<void> {
    await this.sendPushNotification(
      ownerUserId,
      '🚌 Nouvelle demande de covoiturage',
      `${requesterName} souhaite rejoindre votre trajet`,
      { type: 'CARPOOL_REQUEST', carpoolId, screen: 'DriverCarpool' },
    );
  }
}
