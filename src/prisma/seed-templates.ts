// prisma/seed-templates.ts
import { PrismaClient } from '@prisma/client';
import { CANCELLATION_CAUSES_SEED } from '../modules/rides/seeds/cancellation-causes.seed';

const prisma = new PrismaClient();

async function seedNotificationTemplates() {
  console.log(' Création des templates de notification...');

  const templates = [
    // RIDE_REQUEST - Push
    {
      type: 'RIDE_REQUEST',
      channel: 'PUSH',
      language: 'fr',
      title: ' Nouvelle course disponible',
      body: 'Course de {{pickup}} vers {{destination}} - Client: {{clientName}}',
      variables: ['pickup', 'destination', 'clientName'],
      priority: 1,
      active: true
    },
    
    // RIDE_ACCEPTED - Push
    {
      type: 'RIDE_ACCEPTED',
      channel: 'PUSH',
      language: 'fr',
      title: 'Course acceptée',
      body: '{{driverName}} arrive dans {{estimatedArrival}} ({{vehiclePlate}})',
      variables: ['driverName', 'vehiclePlate', 'estimatedArrival'],
      priority: 1,
      active: true
    },

    // RIDE_ACCEPTED - Email
    {
      type: 'RIDE_ACCEPTED',
      channel: 'EMAIL',
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
      priority: 2,
      active: true
    },

    // RIDE_COMPLETED - Push
    {
      type: 'RIDE_COMPLETED',
      channel: 'PUSH',
      language: 'fr',
      title: ' Course terminée',
      body: 'Trajet terminé - {{distance}}km en {{duration}} - {{totalFare}} FCFA',
      variables: ['distance', 'duration', 'totalFare'],
      priority: 1,
      active: true
    },

    // DOCUMENT_EXPIRED - Push
    {
      type: 'DOCUMENT_EXPIRED',
      channel: 'PUSH',
      language: 'fr',
      title: ' Document expiré',
      body: 'Votre {{docType}} a expiré le {{expirationDate}}. Renouvelez-le rapidement.',
      variables: ['docType', 'expirationDate'],
      priority: 1,
      active: true
    },

    // DOCUMENT_EXPIRED - Email
    {
      type: 'DOCUMENT_EXPIRED',
      channel: 'EMAIL',
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
      priority: 1,
      active: true
    },

    // DRIVER_APPROVED - Push
    {
      type: 'DRIVER_APPROVED',
      channel: 'PUSH',
      language: 'fr',
      title: 'Félicitations {{firstName}} !',
      body: 'Votre candidature chauffeur a été approuvée. Bienvenue dans l\'équipe !',
      variables: ['firstName'],
      priority: 1,
      active: true
    },

    // PAYMENT_SUCCESS - Push
    {
      type: 'PAYMENT_SUCCESS',
      channel: 'PUSH',
      language: 'fr',
      title: 'Paiement confirmé',
      body: 'Paiement de {{amount}} FCFA effectué avec succès',
      variables: ['amount'],
      priority: 2,
      active: true
    },

    // RESERVATION_REMINDER - Push
    {
      type: 'RESERVATION_REMINDER',
      channel: 'PUSH',
      language: 'fr',
      title: 'Réservation dans 1h',
      body: 'Votre course {{pickup}} → {{destination}} à {{scheduledTime}}',
      variables: ['pickup', 'destination', 'scheduledTime'],
      priority: 1,
      active: true
    },

    // RIDE_REQUEST - IN_APP
{
  type: 'RIDE_REQUEST',
  channel: 'IN_APP',
  language: 'fr',
  title: ' Nouvelle course disponible',
  body: 'Course de {{pickup}} vers {{destination}} - Client: {{clientName}}',
  variables: ['pickup', 'destination', 'clientName'],
  priority: 1,
  active: true
},

{
      type: 'RIDE_ACCEPTED',
      channel: 'IN_APP',
      language: 'fr',
      title: 'Course acceptée',
      body: '{{driverName}} arrive dans {{estimatedArrival}} avec {{vehicleBrand}} {{vehicleModel}} ({{plateNumber}})',
      variables: JSON.stringify(['driverName', 'estimatedArrival', 'vehicleBrand', 'vehicleModel', 'plateNumber']),
      priority: 1,
      active: true
    },

    // RIDE_STARTED - Tous les canaux
    {
      type: 'RIDE_STARTED',
      channel: 'IN_APP',
      language: 'fr',
      title: ' Course démarrée',
      body: 'Direction {{destination}} - Durée estimée: {{estimatedDuration}}',
      variables: JSON.stringify(['destination', 'estimatedDuration']),
      priority: 1,
      active: true
    },
    {
      type: 'RIDE_STARTED',
      channel: 'PUSH',
      language: 'fr',
      title: 'Course démarrée',
      body: 'Direction {{destination}} - Durée estimée: {{estimatedDuration}}',
      variables: JSON.stringify(['destination', 'estimatedDuration']),
      priority: 1,
      active: true
    },

    // RIDE_COMPLETED - IN_APP
    {
      type: 'RIDE_COMPLETED',
      channel: 'IN_APP',
      language: 'fr',
      title: ' Course terminée',
      body: 'Trajet: {{distance}}km en {{duration}} minutes - Montant: {{totalFare}} FCFA',
      variables: JSON.stringify(['distance', 'duration', 'totalFare']),
      priority: 1,
      active: true
    },

    // RIDE_CANCELED - Tous les canaux
    {
      type: 'RIDE_CANCELED',
      channel: 'IN_APP',
      language: 'fr',
      title: ' Course annulée',
      body: 'Course annulée par {{canceledBy}} - Raison: {{reason}}',
      variables: JSON.stringify(['canceledBy', 'reason', 'pickup', 'destination']),
      priority: 1,
      active: true
    },
    {
      type: 'RIDE_CANCELED',
      channel: 'PUSH',
      language: 'fr',
      title: ' Course annulée',
      body: 'Course annulée par {{canceledBy}}',
      variables: JSON.stringify(['canceledBy', 'reason']),
      priority: 1,
      active: true
    },


  ];

  let created = 0;
  let existing = 0;
  let errors = 0;

  for (const template of templates) {
    try {
      // Vérifier si le template existe déjà
      const existingTemplate = await prisma.notificationTemplate.findFirst({
        where: {
          type: template.type as any,
          channel: template.channel as any,
          language: template.language
        }
      });

      if (!existingTemplate) {
        await prisma.notificationTemplate.create({
          data: template as any
        });
        created++;
        console.log(` Créé: ${template.type}/${template.channel}/${template.language}`);
      } else {
        existing++;
        console.log(`ℹ Existe: ${template.type}/${template.channel}/${template.language}`);
      }
    } catch (error) {
      console.error(` Erreur pour ${template.type}/${template.channel}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`\n Seed terminé: ${created} créés, ${existing} existants`);
}

async function seedCancellationCauses() {
  console.log(' Création des causes d\'annulation...');
  
  for (const cause of CANCELLATION_CAUSES_SEED) {
//     await prisma.cancellationCause.upsert({
//       where: { id: cause.label },
//       update: {},
//       create: cause,
//     });
//   }
//   console.log(' Causes d\'annulation créées');
await prisma.cancellationCause.createMany({
  data: CANCELLATION_CAUSES_SEED.map(cause => ({
    label: cause.label,
    description: cause.description,
  })),
  skipDuplicates: true,
})


}};


async function listAllTemplates() {
  console.log('\n📋 Templates existants dans la base:');
  
  const templates = await prisma.notificationTemplate.findMany({
    select: {
      type: true,
      channel: true,
      language: true,
      active: true
    },
    orderBy: [
      { type: 'asc' },
      { channel: 'asc' }
    ]
  });

  const grouped = templates.reduce((acc, t) => {
    if (!acc[t.type]) acc[t.type] = [];
    acc[t.type].push(`${t.channel} (${t.language})`);
    return acc;
  }, {} as Record<string, string[]>);

  for (const [type, channels] of Object.entries(grouped)) {
    console.log(`\n  ${type}:`);
    channels.forEach(c => console.log(`    - ${c}`));
  }
}


async function main() {
  try {
    
    await seedNotificationTemplates();
    await seedCancellationCauses(); // Ajoutez cette ligne
    console.log('\n TOUS LES SEEDS TERMINÉS !');
  } catch (error) {
    console.error(' Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

