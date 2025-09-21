import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class CarpoolNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notifyNewCarpoolRequest(requestId: string) {
    const request = await this.prisma.carpoolRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { include: { user: true } },
        targetReservation: {
          include: {
            client: { include: { user: true } }
          }
        }
      }
    });

    if (!request) return;

    // 1. Trouver ou créer le template
    const template = await this.getOrCreateTemplate(
      'CARPOOL_REQUEST_RECEIVED',
      'PUSH',
      'Nouvelle demande de covoiturage',
      '{{requesterName}} souhaite rejoindre votre trajet {{route}}'
    );

    // 2. Créer la notification avec templateId
    await this.prisma.notification.create({
      data: {
        userId: request.targetReservation.client.userId,
        templateId: template.id,
        type: 'CARPOOL_REQUEST_RECEIVED' as NotificationType,
         channel: 'PUSH',
        title: 'Nouvelle demande de covoiturage',
        body: `${request.requester.user.firstName} souhaite rejoindre votre trajet ${request.targetReservation.pickupAddress} → ${request.targetReservation.destinationAddress}`,
        metadata: {
          requestId: request.id,
          reservationId: request.targetReservationId,
          requesterName: request.requester.user.firstName
        }
      }
    });
  }

  async notifyRequestResponse(requestId: string, accepted: boolean) {
    const request = await this.prisma.carpoolRequest.findUnique({
      where: { id: requestId },
      include: {
        requester: { include: { user: true } },
        targetReservation: {
          include: {
            client: { include: { user: true } }
          }
        }
      }
    });

    if (!request) return;

    const type = accepted ? 'CARPOOL_REQUEST_ACCEPTED' : 'CARPOOL_REQUEST_REJECTED';
    const templateTitle = accepted ? 'Demande de covoiturage acceptée ✅' : 'Demande de covoiturage refusée ❌';
    const templateBody = accepted 
      ? '{{ownerName}} a accepté votre demande ! RDV le {{scheduledDate}}'
      : '{{ownerName}} a décliné votre demande de covoiturage';

    // 1. Template
    const template = await this.getOrCreateTemplate(
      type,
      'PUSH',
      templateTitle,
      templateBody
    );

    // 2. Notification
    const title = accepted ? 'Demande de covoiturage acceptée ✅' : 'Demande de covoiturage refusée ❌';
    const body = accepted 
      ? `${request.targetReservation.client.user.firstName} a accepté votre demande ! RDV le ${request.targetReservation.scheduledAt.toLocaleDateString()}`
      : `${request.targetReservation.client.user.firstName} a décliné votre demande de covoiturage`;

    await this.prisma.notification.create({
      data: {
        userId: request.requester.userId,
        templateId: template.id,
        type: type as NotificationType,
        title,
        channel: 'PUSH',
        body,
        metadata: {
          requestId: request.id,
          reservationId: request.targetReservationId,
          accepted,
          ownerName: request.targetReservation.client.user.firstName
        }
      }
    });
  }

  private async getOrCreateTemplate(
    type: string,
    channel: string,
    title: string,
    body: string
  ) {
    // Chercher template existant
    let template = await this.prisma.notificationTemplate.findFirst({
      where: {
        type: type as NotificationType,
        channel: channel as any,
        language: 'fr'
      }
    });

    // Créer si n'existe pas
    if (!template) {
      template = await this.prisma.notificationTemplate.create({
        data: {
          type: type as NotificationType,
          channel: channel as any,
          title,
          body,
          language: 'fr',
          active: true,
          priority: 1
        }
      });
    }

    return template;
  }
}