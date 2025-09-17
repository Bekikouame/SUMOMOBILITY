// src/modules/rides/tracking/ride-tracking.service.ts
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RideStatus, DriverStatus } from '@prisma/client';

export interface LocationUpdate {
  latitude: number;
  longitude: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  timestamp?: Date;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  timestamp: Date;
  speed?: number;
  heading?: number;
}

@Injectable()
export class RideTrackingService {
  private readonly logger = new Logger(RideTrackingService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2
  ) {}

  // ===============================
  // MISE À JOUR POSITION CHAUFFEUR
  // ===============================
  async updateDriverLocation(driverId: string, location: LocationUpdate) {
    this.logger.log(`Updating location for driver ${driverId}`);

    // Vérifier que le chauffeur existe et est approuvé
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true }
    });

    if (!driver || driver.status !== DriverStatus.APPROVED) {
      throw new BadRequestException('Driver not found or not approved');
    }

    // Mettre à jour la position du chauffeur
    const updatedLocation = await this.prisma.driverLocation.upsert({
      where: { driverId },
      update: {
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading,
        speed: location.speed,
        accuracy: location.accuracy,
        lastPing: new Date(),
        isOnline: true
      },
      create: {
        driverId,
        latitude: location.latitude,
        longitude: location.longitude,
        heading: location.heading,
        speed: location.speed,
        accuracy: location.accuracy,
        lastPing: new Date(),
        isOnline: true,
        isAvailable: true
      }
    });

    // Vérifier si le chauffeur a une course active
    const activeRide = await this.prisma.ride.findFirst({
      where: {
        driverId,
        status: { in: [RideStatus.ACCEPTED, RideStatus.IN_PROGRESS] }
      },
      include: {
        client: { include: { user: true } }
      }
    });

    if (activeRide) {
      // Enregistrer le point de suivi pour cette course
      await this.recordTrackingPoint(activeRide.id, location);

      // Calculer ETA si la course est acceptée mais pas encore commencée
      let eta: number | null = null;
      if (activeRide.status === RideStatus.ACCEPTED) {
        eta = await this.calculateETA(
          location.latitude,
          location.longitude,
          activeRide.pickupLatitude!,
          activeRide.pickupLongitude!
        );
      }

      // Émettre l'événement pour les WebSockets
      this.eventEmitter.emit('ride.location.updated', {
        rideId: activeRide.id,
        driverId,
        clientId: activeRide.clientId,
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          heading: location.heading,
          speed: location.speed,
          timestamp: new Date()
        },
        eta,
        rideStatus: activeRide.status
      });
    }

    return updatedLocation;
  }

  // ===============================
  // ENREGISTREMENT DES POINTS DE SUIVI
  // ===============================
  private async recordTrackingPoint(rideId: string, location: LocationUpdate) {
    // Créer un enregistrement de suivi (vous devrez ajouter ce modèle à Prisma)
    try {
      // Cette table stockera l'historique du trajet
      await this.prisma.$executeRaw`
        INSERT INTO ride_tracking_points (id, ride_id, latitude, longitude, speed, heading, timestamp)
        VALUES (gen_random_uuid(), ${rideId}, ${location.latitude}, ${location.longitude}, 
                ${location.speed || null}, ${location.heading || null}, ${new Date()})
      `;
    } catch (error) {
      this.logger.warn(`Failed to record tracking point: ${error.message}`);
    }
  }

  // ===============================
  // CALCUL ETA (TEMPS D'ARRIVÉE ESTIMÉ)
  // ===============================
  private async calculateETA(
    currentLat: number,
    currentLng: number,
    destinationLat: number,
    destinationLng: number
  ): Promise<number> {
    // Calcul basique - distance euclidienne convertie en temps
    const distance = this.calculateDistance(currentLat, currentLng, destinationLat, destinationLng);
    
    // Vitesse moyenne estimée en ville : 25 km/h
    const avgSpeedKmh = 25;
    const etaMinutes = Math.ceil((distance / avgSpeedKmh) * 60);
    
    return Math.max(etaMinutes, 2); // Minimum 2 minutes
  }

  // ===============================
  // RÉCUPÉRATION POSITION EN TEMPS RÉEL
  // ===============================
  async getRideTracking(rideId: string, userId: string) {
    // Vérifier que l'utilisateur a accès à cette course
    const ride = await this.validateRideAccess(rideId, userId);

    // Récupérer la position actuelle du chauffeur
    let driverLocation: {
      latitude: number;
      longitude: number;
      heading: number | null;
      speed: number | null;
      lastPing: Date;
      isOnline: boolean;
    } | null = null;

    if (ride.driverId) {
      driverLocation = await this.prisma.driverLocation.findUnique({
        where: { driverId: ride.driverId },
        select: {
          latitude: true,
          longitude: true,
          heading: true,
          speed: true,
          lastPing: true,
          isOnline: true
        }
      });
    }

    // Calculer l'ETA selon le statut de la course
    let eta: number | null = null;
    if (driverLocation && ride.status === RideStatus.ACCEPTED) {
      // ETA vers le point de prise en charge
      eta = await this.calculateETA(
        driverLocation.latitude,
        driverLocation.longitude,
        ride.pickupLatitude!,
        ride.pickupLongitude!
      );
    } else if (driverLocation && ride.status === RideStatus.IN_PROGRESS) {
      // ETA vers la destination
      eta = await this.calculateETA(
        driverLocation.latitude,
        driverLocation.longitude,
        ride.destinationLatitude!,
        ride.destinationLongitude!
      );
    }

    return {
      rideId,
      status: ride.status,
      driverLocation,
      eta,
      pickup: {
        address: ride.pickupAddress,
        latitude: ride.pickupLatitude,
        longitude: ride.pickupLongitude
      },
      destination: {
        address: ride.destinationAddress,
        latitude: ride.destinationLatitude,
        longitude: ride.destinationLongitude
      },
      lastUpdate: driverLocation?.lastPing
    };
  }

  // ===============================
  // HISTORIQUE DU TRAJET
  // ===============================
  async getRideTrackingHistory(rideId: string, userId: string) {
    await this.validateRideAccess(rideId, userId);

    // Récupérer tous les points de suivi pour cette course
    const trackingPoints = await this.prisma.$queryRaw<RoutePoint[]>`
      SELECT latitude, longitude, timestamp, speed, heading
      FROM ride_tracking_points 
      WHERE ride_id = ${rideId}
      ORDER BY timestamp ASC
    `;

    return {
      rideId,
      trackingPoints,
      totalPoints: trackingPoints.length
    };
  }

  // ===============================
  // GESTION CHAUFFEUR HORS LIGNE
  // ===============================
  async markDriverOffline(driverId: string) {
    await this.prisma.driverLocation.update({
      where: { driverId },
      data: {
        isOnline: false,
        isAvailable: false
      }
    });

    // Vérifier si le chauffeur a une course active
    const activeRide = await this.prisma.ride.findFirst({
      where: {
        driverId,
        status: { in: [RideStatus.ACCEPTED, RideStatus.IN_PROGRESS] }
      }
    });

    if (activeRide) {
      this.eventEmitter.emit('driver.went.offline', {
        rideId: activeRide.id,
        driverId,
        clientId: activeRide.clientId
      });
    }
  }

  // ===============================
  // MÉTHODES UTILITAIRES
  // ===============================
  private async validateRideAccess(rideId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { clientProfile: true, driverProfile: true }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        client: true,
        driver: true
      }
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    // Vérifier les droits d'accès
    const hasAccess = 
      user.role === 'ADMIN' ||
      (user.clientProfile && ride.clientId === user.clientProfile.id) ||
      (user.driverProfile && ride.driverId === user.driverProfile.id);

    if (!hasAccess) {
      throw new BadRequestException('Access denied');
    }

    return ride;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // ===============================
  // NETTOYAGE DES DONNÉES ANCIENNES
  // ===============================
  async cleanupOldTrackingData() {
    // Supprimer les points de suivi de plus de 30 jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    await this.prisma.$executeRaw`
      DELETE FROM ride_tracking_points 
      WHERE timestamp < ${thirtyDaysAgo}
    `;

    this.logger.log('Old tracking data cleaned up');
  }
}