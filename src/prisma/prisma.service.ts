// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly prisma: PrismaClient;
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(this.pool);
    this.prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    await this.prisma.$connect();
    console.log('✅ Base de données connectée (Prisma 7 + adapter PG)');
  }

  async onModuleDestroy() {
    await this.prisma.$disconnect();
    await this.pool.end();
    console.log('✅ Base de données déconnectée (Prisma 7 + adapter PG)');
  }

  // === Modèles (garde les tiens comme avant) ===
  get user() {
    return this.prisma.user;
  }

  get clientProfile() {
    return this.prisma.clientProfile;
  }

  get driverProfile() {
    return this.prisma.driverProfile;
  }

  get vehicle() {
    return this.prisma.vehicle;
  }

  get driverDocument() {
    return this.prisma.driverDocument;
  }

  get reservation() {
    return this.prisma.reservation;
  }

  get ride() {
    return this.prisma.ride;
  }

  get payment() {
    return this.prisma.payment;
  }

  get reservationPayment() {
    return this.prisma.reservationPayment;
  }

  get ridePayment() {
    return this.prisma.ridePayment;
  }

  get rating() {
    return this.prisma.rating;
  }

  get cancellationCause() {
    return this.prisma.cancellationCause;
  }

  get passwordResetCode() {
    return this.prisma.passwordResetCode;
  }

  get phoneOtp() {
    return this.prisma.phoneOtp;
  }

  get carpoolRequest() {
    return this.prisma.carpoolRequest;
  }

  get sharedPassenger() {
    return this.prisma.sharedPassenger;
  }

  get notification() {
    return this.prisma.notification;
  }

  get notificationTemplate() {
    return this.prisma.notificationTemplate;
  }

  get notificationPreference() {
    return this.prisma.notificationPreference;
  }

  get adminLog() {
    return this.prisma.adminLog;
  }

  get report() {
    return this.prisma.report;
  }

  get systemConfig() {
    return this.prisma.systemConfig;
  }

  get driverLocation() {
    return this.prisma.driverLocation;
  }

  get pointOfInterest() {
    return this.prisma.pointOfInterest;
  }

  get serviceZone() {
    return this.prisma.serviceZone;
  }

  // === Wallet Models ===
  get wallet() {
    return this.prisma.wallet;
  }

  get walletTransaction() {
    return this.prisma.walletTransaction;
  }

  get driverPaymentMethod() {
    return this.prisma.driverPaymentMethod;
  }

  // === Méthodes Prisma ===
  get rideTrackingPoint() {
    return this.prisma.rideTrackingPoint;
  }

  get $transaction() {
    return this.prisma.$transaction.bind(this.prisma);
  }

  get $queryRaw() {
    return this.prisma.$queryRaw.bind(this.prisma);
  }

  get $executeRaw() {
    return this.prisma.$executeRaw.bind(this.prisma);
  }

  get $connect() {
    return this.prisma.$connect.bind(this.prisma);
  }

  get $disconnect() {
    return this.prisma.$disconnect.bind(this.prisma);
  }

  // === Nettoyage ===
  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Ne pas nettoyer la base en production !');
    }

    const models = [
      'rating',
      'ridePayment',
      'reservationPayment',
      'payment',
      'ride',
      'reservation',
      'driverDocument',
      'vehicle',
      'walletTransaction',
      'driverPaymentMethod',
      'wallet',
      'driverProfile',
      'clientProfile',
      'user',
      'cancellationCause',
      'passwordResetCode',
      'carpoolRequest',
      'sharedPassenger',
      'notification',
      'notificationTemplate',
      'notificationPreference',
      'adminLog',
      'report',
      'systemConfig',
      'driverLocation',
      'pointOfInterest',
      'serviceZone'
    ];

    for (const model of models) {
      try {
        // @ts-ignore accès dynamique
        await this.prisma[model].deleteMany({});
      } catch (error: any) {
        console.log(`Impossible de nettoyer ${model}:`, error.message);
      }
    }

    console.log(' Base de données nettoyée');
  }
}
