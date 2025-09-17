import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      // Configuration de la base de données
      log: ['query', 'info', 'warn', 'error'], // Logs en développement
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    // Connexion à la base de données au démarrage du module
    await this.$connect();
    console.log('✅ Base de données connectée');
  }

  async onModuleDestroy() {
    // Fermeture de la connexion lors de l'arrêt
    await this.$disconnect();
    console.log('❌ Base de données déconnectée');
  }

  // Méthode utilitaire pour nettoyer la base en développement
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Ne pas nettoyer la base en production !');
    }

    // Ordre important pour respecter les contraintes de clés étrangères
    const models = [
      'rating',
      'ridePayment',
      'reservationPayment',
      'payment',
      'ride',
      'reservation',
      'driverDocument',
      'vehicle',
      'driverProfile',
      'clientProfile',
      'user',
      'cancellationCause',
      
    ];

    for (const model of models) {
      await this[model].deleteMany({});
    }

    console.log(' Base de données nettoyée');
  }
}