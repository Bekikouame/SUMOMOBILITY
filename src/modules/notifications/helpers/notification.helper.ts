import { NotificationType } from '@prisma/client';

/**
 * Helper pour créer des notifications standardisées
 */
export class NotificationHelper {
  
  /**
   * Notification pour nouvelle course demandée
   */
  static rideRequested(clientName: string, pickup: string, destination: string) {
    return {
      type: NotificationType.RIDE_REQUEST,
      variables: {
        clientName,
        pickup,
        destination,
        estimatedTime: '5-10 min'
      }
    };
  }

  /**
   * Notification pour course acceptée
   */
  static rideAccepted(driverName: string, vehiclePlate: string, estimatedArrival: string) {
    return {
      type: NotificationType.RIDE_ACCEPTED,
      variables: {
        driverName,
        vehiclePlate,
        estimatedArrival
      }
    };
  }

  /**
   * Notification pour course commencée
   */
  static rideStarted(destination: string, estimatedDuration: string) {
    return {
      type: NotificationType.RIDE_STARTED,
      variables: {
        destination,
        estimatedDuration
      }
    };
  }

  /**
   * Notification pour course terminée
   */
  static rideCompleted(totalFare: number, distance: number, duration: string) {
    return {
      type: NotificationType.RIDE_COMPLETED,
      variables: {
        totalFare: totalFare.toString(),
        distance: distance.toString(),
        duration
      }
    };
  }

  /**
   * Notification pour document expiré
   */
  static documentExpired(docType: string, expirationDate: string) {
    return {
      type: NotificationType.DOCUMENT_EXPIRED,
      variables: {
        docType,
        expirationDate,
        renewalUrl: process.env.FRONTEND_URL + '/driver/documents'
      }
    };
  }

  /**
   * Notification pour chauffeur approuvé
   */
  static driverApproved(firstName: string) {
    return {
      type: NotificationType.DRIVER_APPROVED,
      variables: {
        firstName,
        nextSteps: 'Vous pouvez maintenant ajouter votre véhicule et commencer à recevoir des courses.'
      }
    };
  }
}
