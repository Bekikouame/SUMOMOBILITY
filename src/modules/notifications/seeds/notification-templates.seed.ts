import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationType, NotificationChannel } from '@prisma/client';

export async function seedNotificationTemplates(prisma: PrismaService) {
  console.log(' Création des templates de notification...');

  const templates = [
    // RIDE_REQUEST - Push
    {
      type: NotificationType.RIDE_REQUEST,
      channel: NotificationChannel.PUSH,
      language: 'fr',
      title: ' Nouvelle course disponible',
      body: 'Course de {{pickup}} vers {{destination}} - Client: {{clientName}}',
      variables: ['pickup', 'destination', 'clientName'],
      priority: 1
    },
    
    // RIDE_ACCEPTED - Push
    {
      type: NotificationType.RIDE_ACCEPTED,
      channel: NotificationChannel.PUSH,
      language: 'fr',
      title: 'Course acceptée',
      body: '{{driverName}} arrive dans {{estimatedArrival}} ({{vehiclePlate}})',
      variables: ['driverName', 'vehiclePlate', 'estimatedArrival'],
      priority: 1
    },

    // RIDE_ACCEPTED - Email
    {
      type: NotificationType.RIDE_ACCEPTED,
      channel: NotificationChannel.EMAIL,
      language: 'fr',
      title: 'Course acceptée',
      subject: 'Votre chauffeur arrive bientôt',
      body: `Bonjour,

Bonne nouvelle ! Votre course a été acceptée par {{driverName}}.

 Véhicule: {{vehiclePlate}}
 Arrivée estimée: {{estimatedArrival}}

Vous pouvez suivre l'avancement depuis l'application.

Bonne route !
L'équipe VTC`,
      variables: ['driverName', 'vehiclePlate', 'estimatedArrival'],
      priority: 2
    },

    // RIDE_COMPLETED - Push
    {
      type: NotificationType.RIDE_COMPLETED,
      channel: NotificationChannel.PUSH,
      language: 'fr',
      title: ' Course terminée',
      body: 'Trajet terminé - {{distance}}km en {{duration}} - {{totalFare}} FCFA',
      variables: ['distance', 'duration', 'totalFare'],
      priority: 1
    },

    // DOCUMENT_EXPIRED - Push
    {
      type: NotificationType.DOCUMENT_EXPIRED,
      channel: NotificationChannel.PUSH,
      language: 'fr',
      title: ' Document expiré',
      body: 'Votre {{docType}} a expiré le {{expirationDate}}. Renouvelez-le rapidement.',
      variables: ['docType', 'expirationDate'],
      priority: 1
    },

    // DOCUMENT_EXPIRED - Email
    {
      type: NotificationType.DOCUMENT_EXPIRED,
      channel: NotificationChannel.EMAIL,
      language: 'fr',
      title: 'Document expiré',
      subject: 'URGENT: Renouvellement de document requis',
      body: `Bonjour,

 ATTENTION: Votre document {{docType}} a expiré le {{expirationDate}}.

Pour continuer à recevoir des courses, vous devez impérativement renouveler ce document.

 Connectez-vous sur {{renewalUrl}}

En cas de question, contactez notre support.

Cordialement,
L'équipe VTC`,
      variables: ['docType', 'expirationDate', 'renewalUrl'],
      priority: 1
    },

    // DRIVER_APPROVED - Push
    {
      type: NotificationType.DRIVER_APPROVED,
      channel: NotificationChannel.PUSH,
      language: 'fr',
      title: '🎉 Félicitations {{firstName}} !',
      body: 'Votre candidature chauffeur a été approuvée. Bienvenue dans l\'équipe !',
      variables: ['firstName'],
      priority: 1
    },

    // PAYMENT_SUCCESS - Push
    {
      type: NotificationType.PAYMENT_SUCCESS,
      channel: NotificationChannel.PUSH,
      language: 'fr',
      title: '✅ Paiement confirmé',
      body: 'Paiement de {{amount}} FCFA effectué avec succès',
      variables: ['amount'],
      priority: 2
    },

    // RESERVATION_REMINDER - Push
    {
      type: NotificationType.RESERVATION_REMINDER,
      channel: NotificationChannel.PUSH,
      language: 'fr',
      title: '⏰ Réservation dans 1h',
      body: 'Votre course {{pickup}} → {{destination}} à {{scheduledTime}}',
      variables: ['pickup', 'destination', 'scheduledTime'],
      priority: 1
    }
  ];

  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: {
        type_channel_language: {
          type: template.type,
          channel: template.channel,
          language: template.language
        }
      },
      update: {},
      create: template
    });
  }

  console.log(` ${templates.length} templates de notification créés`);
}
