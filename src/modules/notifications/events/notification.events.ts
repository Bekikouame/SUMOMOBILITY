import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../services/notifications.service';
import { NotificationHelper } from '../helpers/notification.helper';
import { NotificationType } from '@prisma/client';


/**
 * Gestionnaire des événements pour notifications automatiques
 */
@Injectable()
export class NotificationEventHandler {
  constructor(
    private notificationsService: NotificationsService,
    private eventEmitter: EventEmitter2
  ) {}

  /**
   * Événement: Nouvelle course demandée
   */
  @OnEvent('ride.requested')
  async handleRideRequested(payload: {
    rideId: string;
    clientId: string;
    clientName: string;
    driverId: string;
    pickup: string;
    destination: string;
  }) {
    const notificationData = NotificationHelper.rideRequested(
      payload.clientName,
      payload.pickup,
      payload.destination
    );

    await this.notificationsService.sendNotification({
      ...notificationData,
      userId: payload.driverId,
      metadata: {
        rideId: payload.rideId,
        clientId: payload.clientId
      }
    });
  }

  /**
   * Événement: Course acceptée par chauffeur
   */
  @OnEvent('ride.accepted')
  async handleRideAccepted(payload: {
    rideId: string;
    clientId: string;
    driverId: string;
    driverName: string;
    vehiclePlate: string;
    estimatedArrival: string;
  }) {
    const notificationData = NotificationHelper.rideAccepted(
      payload.driverName,
      payload.vehiclePlate,
      payload.estimatedArrival
    );

    await this.notificationsService.sendNotification({
      ...notificationData,
      userId: payload.clientId,
      metadata: {
        rideId: payload.rideId,
        driverId: payload.driverId
      }
    });
  }

  /**
   * Événement: Course terminée
   */
  @OnEvent('ride.completed')
  async handleRideCompleted(payload: {
    rideId: string;
    clientId: string;
    driverId: string;
    totalFare: number;
    distance: number;
    duration: string;
  }) {
    // Notification au client
    const clientNotification = NotificationHelper.rideCompleted(
      payload.totalFare,
      payload.distance,
      payload.duration
    );

    await this.notificationsService.sendNotification({
      ...clientNotification,
      userId: payload.clientId,
      metadata: { rideId: payload.rideId }
    });

    // Notification au chauffeur (différente)
    await this.notificationsService.sendNotification({
      type: NotificationType.RIDE_COMPLETED,
      userId: payload.driverId,
      variables: {
        earnings: (payload.totalFare * 0.8).toString(), // 80% pour le chauffeur
        distance: payload.distance.toString(),
        duration: payload.duration
      },
      metadata: { rideId: payload.rideId }
    });
  }

  /**
   * Événement: Document expiré
   */
  @OnEvent('document.expired')
  async handleDocumentExpired(payload: {
    driverId: string;
    documentId: string;
    docType: string;
    expirationDate: string;
  }) {
    const notificationData = NotificationHelper.documentExpired(
      payload.docType,
      payload.expirationDate
    );

    await this.notificationsService.sendNotification({
      ...notificationData,
      userId: payload.driverId,
      priority: 1, // Haute priorité
      metadata: {
        documentId: payload.documentId
      }
    });
  }

  /**
   * Événement: Chauffeur approuvé
   */
  @OnEvent('driver.approved')
  async handleDriverApproved(payload: {
    driverId: string;
    userId: string;
    firstName: string;
  }) {
    const notificationData = NotificationHelper.driverApproved(payload.firstName);

    await this.notificationsService.sendNotification({
      ...notificationData,
      userId: payload.userId,
      metadata: {
        driverId: payload.driverId
      }
    });
  }
}
