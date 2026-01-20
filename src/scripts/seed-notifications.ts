// src/scripts/seed-notifications.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { seedNotificationTemplates } from '../modules/notifications/seeds/notification-templates.seed';

async function bootstrap() {
  // 1. Démarrer Nest en mode "application context" (sans serveur HTTP)
  const appContext = await NestFactory.createApplicationContext(AppModule);

  // 2. Récupérer PrismaService depuis le container Nest
  const prisma = appContext.get(PrismaService);

  // 3. Lancer ta fonction de seed
  await seedNotificationTemplates(prisma);

  // 4. Fermer proprement
  await appContext.close();
}

bootstrap()
  .then(() => {
    console.log(' Seed des templates terminé.');
  })
  .catch((err) => {
    console.error(' Erreur pendant le seed des notifications :', err);
    process.exit(1);
  });
