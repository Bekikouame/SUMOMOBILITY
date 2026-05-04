// src/modules/rides/rides.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class RidesScheduler {
  private readonly logger = new Logger(RidesScheduler.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ─────────────────────────────────────────────────────────────
  // Toutes les minutes : courses REQUESTED sans chauffeur > 5 min
  // ─────────────────────────────────────────────────────────────
  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleRides() {
    const cutoffDate = new Date(Date.now() - 5 * 60 * 1000);

    const staleRides = await this.prisma.ride.findMany({
      where: { status: 'REQUESTED', requestedAt: { lt: cutoffDate } },
      include: { client: { include: { user: true } } },
    });

    for (const ride of staleRides) {
      await this.prisma.ride.update({
        where: { id: ride.id },
        data: { status: 'CANCELED', canceledAt: new Date(), canceledBy: 'SYSTEM' },
      });

      this.eventEmitter.emit('ride.canceled', {
        rideId: ride.id,
        canceledBy: 'SYSTEM',
        reason: 'Aucun chauffeur disponible dans votre zone',
        clientId: ride.client.user.id,
      });

      this.logger.log(`Course ${ride.id} expirée (sans chauffeur)`);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Toutes les 10 minutes : réservations PENDING dont la date est passée
  // → Logique Yango : PENDING expirée = CANCELED automatiquement
  // ─────────────────────────────────────────────────────────────
  @Cron('*/10 * * * *')
  async expireStaleReservations() {
    const now = new Date();

    // 1. Réservations PENDING dont scheduledAt est dépassé depuis > 30 min
    const expiredPending = await this.prisma.reservation.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) },
      },
      include: { client: { include: { user: true } } },
    });

    for (const res of expiredPending) {
      await this.prisma.reservation.update({
        where: { id: res.id },
        data: { status: 'CANCELED', canceledAt: now },
      });

      this.eventEmitter.emit('reservation.expired', {
        reservationId: res.id,
        clientId: res.client.user.id,
        reason: 'Aucun chauffeur n\'a accepté votre réservation à temps',
      });

      this.logger.log(`Réservation ${res.id} expirée (PENDING sans chauffeur)`);
    }

    // 2. Réservations CONFIRMED dont le ride associé est COMPLETED → FULFILLED
    const toFulfill = await this.prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        ride: { status: 'COMPLETED' },
      },
    });

    for (const res of toFulfill) {
      await this.prisma.reservation.update({
        where: { id: res.id },
        data: { status: 'FULFILLED' },
      });
      this.logger.log(`Réservation ${res.id} → FULFILLED (ride terminé)`);
    }

    // 3. Réservations CONFIRMED dont le ride associé est CANCELED → CANCELED
    const toCancelFromRide = await this.prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        ride: { status: 'CANCELED' },
      },
    });

    for (const res of toCancelFromRide) {
      await this.prisma.reservation.update({
        where: { id: res.id },
        data: { status: 'CANCELED', canceledAt: now },
      });
      this.logger.log(`Réservation ${res.id} → CANCELED (ride annulé)`);
    }

    // 4. Réservations CONFIRMED sans ride dont scheduledAt est dépassé depuis > 2h
    const abandonedConfirmed = await this.prisma.reservation.findMany({
      where: {
        status: 'CONFIRMED',
        rideId: null,
        scheduledAt: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
      },
      include: { client: { include: { user: true } } },
    });

    for (const res of abandonedConfirmed) {
      await this.prisma.reservation.update({
        where: { id: res.id },
        data: { status: 'CANCELED', canceledAt: now },
      });
      this.logger.log(`Réservation ${res.id} expirée (CONFIRMED sans départ)`);
    }

    if (expiredPending.length + toFulfill.length + toCancelFromRide.length + abandonedConfirmed.length > 0) {
      this.logger.log(
        `Sync réservations : ${expiredPending.length} expirées, ${toFulfill.length} FULFILLED, ` +
        `${toCancelFromRide.length} annulées, ${abandonedConfirmed.length} abandonnées`
      );
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Toutes les 15 minutes : CarpoolRequests dont expiresAt est passé
  // ─────────────────────────────────────────────────────────────
  @Cron('*/15 * * * *')
  async expireCarpoolRequests() {
    const now = new Date();

    const expired = await this.prisma.carpoolRequest.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lt: now },
      },
      data: { status: 'EXPIRED' },
    });

    if (expired.count > 0) {
      this.logger.log(`${expired.count} demande(s) de covoiturage expirée(s)`);
    }
  }
}
