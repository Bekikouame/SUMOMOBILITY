// src/modules/rides/rides.service.ts
import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ForbiddenException,
  Logger 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RideStatus, UserRole, VehicleStatus, DriverStatus, NotificationType } from '@prisma/client';
import { CreateRideDto } from './dto/create-ride.dto';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { QueryRidesDto } from './dto/query-rides.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { NotificationsService } from '../notifications/services/notifications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    private prisma: PrismaService, 
    private notificationsService: NotificationsService, 
    private eventEmitter: EventEmitter2
  ) {}

  // ===============================
  // CRÉATION DE COURSE
  // ===============================
// Méthode createRide corrigée
async createRide(userId: string, createRideDto: CreateRideDto) {
  this.logger.log(`Creating ride for user ${userId}`);

  // Validation de l'ID utilisateur
  if (!userId) {
    throw new BadRequestException('L\'ID utilisateur est requis');
  }

  // Vérifier que l'utilisateur est CLIENT (une seule fois)
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { clientProfile: true }
  });

  if (!user) {
    throw new NotFoundException('Utilisateur non trouvé');
  }

  if (user.role !== UserRole.CLIENT || !user.clientProfile) {
    throw new BadRequestException('Seuls les clients peuvent demander une course');
  }

  // Calculer distance et tarif estimé
  const distance = this.calculateDistance(
    createRideDto.pickupLatitude,
    createRideDto.pickupLongitude,
    createRideDto.destinationLatitude,
    createRideDto.destinationLongitude
  );

  const estimatedFare = this.calculateFare(distance, createRideDto.rideType || 'STANDARD');

  // Créer la course
  const ride = await this.prisma.ride.create({
    data: {
      clientId: user.clientProfile.id,
      rideType: createRideDto.rideType || 'STANDARD',
      pickupAddress: createRideDto.pickupAddress,
      destinationAddress: createRideDto.destinationAddress,
      pickupLatitude: createRideDto.pickupLatitude,
      pickupLongitude: createRideDto.pickupLongitude,
      destinationLatitude: createRideDto.destinationLatitude,
      destinationLongitude: createRideDto.destinationLongitude,
      passengerCount: createRideDto.passengerCount || 1,
      notes: createRideDto.notes,
      status: RideStatus.REQUESTED,
      requestedAt: new Date(),
      baseFare: estimatedFare,
      totalFare: estimatedFare,
    },
    include: {
      client: {
        include: { user: { select: { firstName: true, lastName: true, phone: true } } }
      }
    }
  });

  // Notifier la création de course au client
  await this.notificationsService.sendNotification({
    type: NotificationType.RIDE_REQUEST,
    userId: userId,
    variables: {
      message: `Demande de course créée avec succès`,
      rideId: ride.id,
      pickup: ride.pickupAddress,
      destination: ride.destinationAddress,
      estimatedFare: `${estimatedFare} FCFA`,
      details: `Votre course de ${ride.pickupAddress} vers ${ride.destinationAddress} a été enregistrée`
    },
    metadata: { rideId: ride.id }
  });

  // Lancer la recherche de chauffeurs disponibles
  this.findAvailableDrivers(ride.id).catch(error => {
    this.logger.error(`Error finding drivers for ride ${ride.id}:`, error);
  });

  return ride;
}

  // ===============================
  // RECHERCHE CHAUFFEURS DISPONIBLES
  // ===============================
  private async findAvailableDrivers(rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        client: {
          include: { user: true }
        }
      }
    });

    if (!ride || ride.status !== RideStatus.REQUESTED) {
      return;
    }

    // Recherche chauffeurs dans un rayon de 10km
    const availableDrivers = await this.prisma.driverProfile.findMany({
      where: {
        status: DriverStatus.APPROVED,
        vehicles: {
          some: {
            status: VehicleStatus.AVAILABLE,
            verified: true,
            capacity: { gte: ride.passengerCount }
          }
        }
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, phone: true } },
        vehicles: {
          where: {
            status: VehicleStatus.AVAILABLE,
            verified: true
          }
        }
      },
      take: 10
    });

    this.logger.log(`Found ${availableDrivers.length} available drivers for ride ${rideId}`);

    // Notifier chaque chauffeur disponible de la nouvelle course
    for (const driver of availableDrivers.slice(0, 5)) { // Limiter à 5 chauffeurs
      // Calculer la distance de manière sécurisée
      const distance = (ride.pickupLatitude && ride.pickupLongitude && ride.destinationLatitude && ride.destinationLongitude) 
        ? this.calculateDistance(
            ride.pickupLatitude,
            ride.pickupLongitude,
            ride.destinationLatitude,
            ride.destinationLongitude
          ).toFixed(1)
        : 'Non calculée';

      await this.notificationsService.sendNotification({
        type: NotificationType.RIDE_REQUEST,
        userId: driver.user.id,
        variables: {
          message: `Nouvelle course disponible`,
          clientName: `${ride.client.user.firstName} ${ride.client.user.lastName}`,
          pickup: ride.pickupAddress,
          destination: ride.destinationAddress,
          distance: `${distance} km`,
          estimatedFare: `${ride.totalFare} FCFA`,
          details: `Course de ${ride.pickupAddress} vers ${ride.destinationAddress}`
        },
        metadata: { 
          rideId: ride.id,
          clientId: ride.clientId 
        }
      });
    }

    // Émettre un événement pour d'autres processus (notifications push, etc.)
    this.eventEmitter.emit('ride.requested', { 
      rideId, 
      availableDrivers,
      clientName: `${ride.client.user.firstName} ${ride.client.user.lastName}`
    });
  }

  // ===============================
  // ACCEPTER UNE COURSE
  // ===============================
  async acceptRide(userId: string, rideId: string) {
    this.logger.log(`Driver ${userId} accepting ride ${rideId}`);

    // Vérifier que l'utilisateur est DRIVER
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { 
        driverProfile: {
          include: {
            vehicles: {
              where: {
                status: VehicleStatus.AVAILABLE,
                verified: true
              }
            }
          }
        }
      }
    });

    if (!user || user.role !== UserRole.DRIVER || !user.driverProfile) {
      throw new ForbiddenException('Only approved drivers can accept rides');
    }

    // Vérification explicite pour éviter l'erreur TypeScript
    const driverProfile = user.driverProfile;
    if (driverProfile.status !== DriverStatus.APPROVED) {
       throw new ForbiddenException('Driver must be approved to accept rides');
    }

    const availableVehicle = driverProfile.vehicles[0];
    if (!availableVehicle) {
      throw new BadRequestException('No available vehicle found');
    }

    // Vérifier que la course est toujours disponible
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        client: {
          include: { user: true }
        }
      }
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.status !== RideStatus.REQUESTED) {
      throw new BadRequestException('Ride is no longer available');
    }

    // Transaction pour accepter la course
    const updatedRide = await this.prisma.$transaction(async (tx) => {
      // Marquer le véhicule comme en utilisation
      await tx.vehicle.update({
        where: { id: availableVehicle.id },
        data: { status: VehicleStatus.IN_USE }
      });

     // Vérifier que l'utilisateur a bien un profil chauffeur
if (!user.driverProfile) {
  throw new BadRequestException('User does not have a driver profile');
}

// Maintenant TypeScript sait que driverProfile n'est pas null
return tx.ride.update({
  where: { id: rideId },
  data: {
    driverId: user.driverProfile.id,
    vehicleId: availableVehicle.id,
    status: RideStatus.ACCEPTED,
    acceptedAt: new Date(),
  },
  include: {
    client: {
      include: { user: true }
    },
    driver: {
      include: { user: true }
    },
    vehicle: true
  }
});
    });

    // Notifier le client que sa course a été acceptée
    await this.notificationsService.sendNotification({
      type: NotificationType.RIDE_ACCEPTED,
      userId: ride.client.user.id,
      variables: {
        message: `Votre course a été acceptée`,
        driverName: `${user.firstName} ${user.lastName}`,
        driverPhone: user.phone || 'Non renseigné',
        vehicleBrand: availableVehicle.brand,
        vehicleModel: availableVehicle.model,
        plateNumber: availableVehicle.plateNumber,
        estimatedArrival: '5-10 minutes',
        details: `${user.firstName} ${user.lastName} arrive dans 5-10 minutes avec ${availableVehicle.brand} ${availableVehicle.model} (${availableVehicle.plateNumber})`
      },
      metadata: { 
        rideId: rideId,
        driverId: user.driverProfile!.id, // Utilisation de l'assertion non-null
        vehicleId: availableVehicle.id
      }
    });

    // Émettre événement
    this.eventEmitter.emit('ride.accepted', {
      rideId,
      clientId: ride.clientId,
      driverId: driverProfile.id, // Utilisation de la variable locale
      driverName: `${user.firstName} ${user.lastName}`
    });

    this.logger.log(`Ride ${rideId} accepted by driver ${driverProfile.id}`);
    return updatedRide;
  }

  // ===============================
  // DÉMARRER UNE COURSE
  // ===============================
  async startRide(userId: string, rideId: string) {
    const ride = await this.validateDriverRide(userId, rideId, [RideStatus.ACCEPTED]);

    const updatedRide = await this.prisma.ride.update({
      where: { id: rideId },
      data: {
        status: RideStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
      include: this.getRideInclude()
    });

    // Notifier le client que la course a commencé
    if (ride.client) {
      await this.notificationsService.sendNotification({
        type: NotificationType.RIDE_STARTED,
        userId: ride.client.user.id,
        variables: {
          message: `Votre course a commencé`,
          destination: ride.destinationAddress,
          estimatedDuration: '15-20 minutes',
          details: `Direction ${ride.destinationAddress}. Durée estimée: 15-20 minutes`
        },
        metadata: { rideId }
      });
    }

    // Émettre événement
    this.eventEmitter.emit('ride.started', {
      rideId,
      clientId: ride.clientId,
      destination: ride.destinationAddress
    });

    this.logger.log(`Ride ${rideId} started`);
    return updatedRide;
  }

  // ===============================
  // TERMINER UNE COURSE
  // ===============================
  async completeRide(userId: string, rideId: string) {
    const ride = await this.validateDriverRide(userId, rideId, [RideStatus.IN_PROGRESS]);

    // Calculer la durée et recalculer le tarif si nécessaire
    const durationMinutes = ride.startedAt 
      ? Math.ceil((Date.now() - ride.startedAt.getTime()) / (1000 * 60))
      : null;

    // Calcul des finances
    const platformFee = ride.totalFare != null 
      ? Number(ride.totalFare) * 0.15 
      : null;

    const driverEarnings = ride.totalFare != null && platformFee != null
      ? Number(ride.totalFare) - platformFee
      : null;

    const updatedRide = await this.prisma.$transaction(async (tx) => {
      // Libérer le véhicule
      if (ride.vehicleId) {
        await tx.vehicle.update({
          where: { id: ride.vehicleId },
          data: { status: VehicleStatus.AVAILABLE }
        });
      }

      // Mettre à jour les stats du chauffeur
      if (ride.driverId && driverEarnings) {
        await tx.driverProfile.update({
          where: { id: ride.driverId },
          data: {
            totalRides: { increment: 1 },
            totalEarnings: { increment: driverEarnings }
          }
        });
      }

      // Terminer la course
      return tx.ride.update({
        where: { id: rideId },
        data: {
          status: RideStatus.COMPLETED,
          completedAt: new Date(),
          durationMinutes,
          driverEarnings,
          platformFee,
        },
        include: this.getRideInclude()
      });
    });

    // Notifier le client et le chauffeur de la fin de course
    if (ride.client) {
      // Calculer la distance de manière sécurisée
      const distance = (ride.pickupLatitude && ride.pickupLongitude && ride.destinationLatitude && ride.destinationLongitude)
        ? this.calculateDistance(
            ride.pickupLatitude,
            ride.pickupLongitude, 
            ride.destinationLatitude,
            ride.destinationLongitude
          ).toFixed(1)
        : 'Non calculée';

      await this.notificationsService.sendNotification({
        type: NotificationType.RIDE_COMPLETED,
        userId: ride.client.user.id,
        variables: {
          message: `Course terminée avec succès`,
          totalFare: `${ride.totalFare} FCFA`,
          distance: `${distance} km`,
          duration: `${durationMinutes} minutes`,
          details: `Course terminée: ${distance} km en ${durationMinutes} minutes pour ${ride.totalFare} FCFA`
        },
        metadata: { rideId }
      });
    }

    // Notifier le chauffeur de ses gains
    const driver = await this.prisma.user.findUnique({
      where: { id: userId }
    });

    if (driver) {
      await this.notificationsService.sendNotification({
        type: NotificationType.RIDE_COMPLETED, // Utiliser un type existant
        userId: driver.id,
        variables: {
          message: `Course terminée avec succès`,
          earnings: `${driverEarnings} FCFA`,
          totalFare: `${ride.totalFare} FCFA`,
          platformFee: `${platformFee} FCFA`,
          details: `Vous avez gagné ${driverEarnings} FCFA sur cette course`
        },
        metadata: { rideId }
      });
    }

    // Émettre événement
    this.eventEmitter.emit('ride.completed', {
      rideId,
      clientId: ride.clientId,
      driverId: ride.driverId,
      totalFare: ride.totalFare,
      driverEarnings
    });

    this.logger.log(`Ride ${rideId} completed`);
    return updatedRide;
  }

  // ===============================
  // ANNULER UNE COURSE
  // ===============================
  async cancelRide(userId: string, rideId: string, cancelDto: CancelRideDto) {
    // Vérifier les droits d'annulation
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
        client: { include: { user: true } },
        driver: { include: { user: true } }
      }
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    // Vérifier que l'utilisateur a le droit d'annuler
    const canCancel = 
      (user.role === UserRole.CLIENT && user.clientProfile && ride.clientId === user.clientProfile.id) ||
      (user.role === UserRole.DRIVER && user.driverProfile && ride.driverId === user.driverProfile.id) ||
      user.role === UserRole.ADMIN;

    if (!canCancel) {
      throw new ForbiddenException('You cannot cancel this ride');
    }

    // Vérifier que la course peut être annulée
    
    if (['COMPLETED', 'CANCELED'].includes(ride.status)) {
  throw new BadRequestException('Cannot cancel a completed or already canceled ride');
}

    // Transaction d'annulation
    const canceledRide = await this.prisma.$transaction(async (tx) => {
      // Libérer le véhicule si un chauffeur était assigné
      if (ride.vehicleId) {
        await tx.vehicle.update({
          where: { id: ride.vehicleId },
          data: { status: VehicleStatus.AVAILABLE }
        });
      }

      // Annuler la course
      return tx.ride.update({
        where: { id: rideId },
        data: {
          status: RideStatus.CANCELED,
          cancellationCauseId: cancelDto.cancellationCauseId,
          canceledBy: cancelDto.canceledBy,
          canceledAt: new Date(),
          notes: cancelDto.additionalReason 
            ? `${ride.notes || ''}\nAnnulation: ${cancelDto.additionalReason}`.trim()
            : ride.notes
        },
        include: this.getRideInclude()
      });
    });

    // Notifier l'autre partie de l'annulation
    const recipientUserId = user.role === UserRole.CLIENT 
      ? ride.driver?.user.id 
      : ride.client.user.id;

    const canceledByText = user.role === UserRole.CLIENT ? 'le client' : 'le chauffeur';

    if (recipientUserId) {
      await this.notificationsService.sendNotification({
        type: NotificationType.RIDE_CANCELED,
        userId: recipientUserId,
        variables: {
          message: `Course annulée`,
          canceledBy: canceledByText,
          reason: cancelDto.additionalReason || 'Aucune raison spécifiée',
          pickup: ride.pickupAddress,
          destination: ride.destinationAddress,
          details: `La course de ${ride.pickupAddress} vers ${ride.destinationAddress} a été annulée par ${canceledByText}`
        },
        metadata: { rideId }
      });
    }

    // Émettre événement
    this.eventEmitter.emit('ride.canceled', {
      rideId,
      canceledBy: canceledByText,
      reason: cancelDto.additionalReason
    });

    this.logger.log(`Ride ${rideId} canceled by ${cancelDto.canceledBy}`);
    return canceledRide;
  }

  // ===============================
  // NOTATION D'UNE COURSE
  // ===============================
  async rateRide(userId: string, rideId: string, ratingDto: CreateRatingDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { clientProfile: true },
    });

    if (!user || user.role !== UserRole.CLIENT || !user.clientProfile) {
      throw new ForbiddenException('Seuls les clients peuvent évaluer les trajets.');
    }

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { 
        ratings: true, 
        driver: { include: { user: true } }
      },
    });

    if (!ride) {
      throw new NotFoundException('Course non trouvée');
    }

    if (ride.clientId !== user.clientProfile.id) {
      throw new ForbiddenException('Vous ne pouvez évaluer que vos propres trajets');
    }

    if (ride.status !== RideStatus.COMPLETED) {
      throw new BadRequestException('Vous ne pouvez évaluer que les trajets terminés');
    }

    if (ride.ratings.length > 0) {
      throw new BadRequestException('Course déjà notée');
    }

    const newRating = await this.prisma.$transaction(async (tx) => {
      const createdRating = await tx.rating.create({
        data: {
          rideId,
          score: ratingDto.score,
          comment: ratingDto.comment,
          punctuality: ratingDto.punctuality,
          cleanliness: ratingDto.cleanliness,
          driving: ratingDto.driving,
          courtesy: ratingDto.courtesy,
        },
      });

      // Mettre à jour la note moyenne du chauffeur
      if (ride.driverId) {
        const avgResult = await tx.rating.aggregate({
          _avg: { score: true },
          where: { ride: { driverId: ride.driverId } },
        });

        await tx.driverProfile.update({
          where: { id: ride.driverId },
          data: { rating: avgResult._avg.score },
        });
      }

      return createdRating;
    });

    // Notifier le chauffeur de la nouvelle évaluation
    if (ride.driver) {
      await this.notificationsService.sendNotification({
        type: NotificationType.RIDE_COMPLETED, // Utiliser un type existant
        userId: ride.driver.user.id,
        variables: {
          message: `Nouvelle évaluation reçue`,
          rating: `${ratingDto.score}/5 étoiles`,
          clientName: `${user.firstName} ${user.lastName}`,
          comment: ratingDto.comment || 'Aucun commentaire',
          details: `Le client ${user.firstName} ${user.lastName} vous a attribué ${ratingDto.score}/5 étoiles`
        },
        metadata: { rideId, ratingId: newRating.id }
      });
    }

    this.logger.log(`Ride ${rideId} rated with score ${ratingDto.score}`);
    return newRating;
  }

  // ===============================
  // RÉCUPÉRATION DES COURSES
  // ===============================
  async findUserRides(userId: string, query: QueryRidesDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { clientProfile: true, driverProfile: true }
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const limit = parseInt(query.limit ?? '10') || 10;
    const offset = parseInt(query.offset ?? '0') || 0;

    let whereCondition: any = {};

    if (user.role === UserRole.CLIENT && user.clientProfile) {
      whereCondition.clientId = user.clientProfile.id;
    } else if (user.role === UserRole.DRIVER && user.driverProfile) {
      whereCondition.driverId = user.driverProfile.id;
    }

    if (query.status) {
      whereCondition.status = query.status;
    }

    if (query.startDate || query.endDate) {
      whereCondition.createdAt = {};
      if (query.startDate) {
        whereCondition.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        whereCondition.createdAt.lte = new Date(query.endDate);
      }
    }

    const rides = await this.prisma.ride.findMany({
      where: whereCondition,
      include: this.getRideInclude(),
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await this.prisma.ride.count({ where: whereCondition });

    return {
      rides,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  async findRideById(userId: string, rideId: string) {
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        ...this.getRideInclude(),
        ratings: true,
        payments: { include: { payment: true } }
      }
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { clientProfile: true, driverProfile: true }
    });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const hasAccess = 
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.CLIENT && ride.clientId === user.clientProfile?.id) ||
      (user.role === UserRole.DRIVER && ride.driverId === user.driverProfile?.id);

    if (!hasAccess) {
      throw new ForbiddenException('Access denied');
    }

    return ride;
  }

  // ===============================
  // MÉTHODES UTILITAIRES
  // ===============================
  private async validateDriverRide(userId: string, rideId: string, allowedStatuses: RideStatus[]) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true }
    });

    if (!user || user.role !== UserRole.DRIVER || !user.driverProfile) {
      throw new ForbiddenException('Only drivers can perform this action');
    }

    // Vérification explicite pour éviter l'erreur TypeScript
    const driverProfile = user.driverProfile;

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { 
        driver: { include: { user: true } },
        client: { include: { user: true } },
        vehicle: true 
      }
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.driverId !== driverProfile.id) {
      throw new ForbiddenException('You can only manage your own rides');
    }

    if (!allowedStatuses.includes(ride.status)) {
      throw new BadRequestException(`Cannot perform this action on ride with status: ${ride.status}`);
    }

    return ride;
  }

  private getRideInclude() {
    return {
      client: {
        include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } }
      },
      driver: {
        include: { user: { select: { id: true, firstName: true, lastName: true, phone: true } } }
      },
      vehicle: true,
      cancellationCause: true
    };
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

  private calculateFare(distanceKm: number, rideType: string): number {
    const baseFare = 500; // Base 500 FCFA
    const perKmRate = rideType === 'PREMIUM' ? 200 : rideType === 'VIP' ? 300 : 150;
    
    return baseFare + (distanceKm * perKmRate);
  }
}