// ===================================
// SERVICE - Logique métier
// ===================================

// src/modules/rides/rides.service.ts
import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ForbiddenException,
  Logger 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RideStatus, UserRole, VehicleStatus, DriverStatus } from '@prisma/client';
import { CreateRideDto } from './dto/create-ride.dto';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { QueryRidesDto } from './dto/query-rides.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(private prisma: PrismaService) {}

  // ===============================
  // CRÉATION DE COURSE
  // ===============================
  async createRide(userId: string, createRideDto: CreateRideDto) {
    this.logger.log(`Creating ride for user ${userId}`);

    // Vérifier que l'utilisateur est CLIENT
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { clientProfile: true }
    });

    if (!user || user.role !== UserRole.CLIENT || !user.clientProfile) {
      throw new BadRequestException('Only clients can request rides');
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
      take: 10 // Limiter à 10 chauffeurs
    });

    this.logger.log(`Found ${availableDrivers.length} available drivers for ride ${rideId}`);

    //  une logique de notification push
    // pour alerter les chauffeurs de la nouvelle course
      
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

    if (user.driverProfile.status !== DriverStatus.APPROVED) {
      throw new ForbiddenException('Driver must be approved to accept rides');
    }

    const availableVehicle = user.driverProfile.vehicles[0];
    if (!availableVehicle) {
      throw new BadRequestException('No available vehicle found');
    }

    // Vérifier que la course est toujours disponible
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        client: {
          include: { user: { select: { firstName: true, lastName: true, phone: true } } }
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

// Récupérer l'utilisateur
const user = await this.prisma.user.findUnique({
  where: { id: userId },
  include: { driverProfile: true }, // Inclure le profil
});

// Valider l'utilisateur
if (!user || user.role !== UserRole.DRIVER || !user.driverProfile) {
  throw new ForbiddenException('Seuls les chauffeurs approuvés peuvent accepter des courses.');
}

      // Mettre à jour la course
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
            include: { user: { select: { firstName: true, lastName: true, phone: true } } }
          },
          driver: {
            include: { user: { select: { firstName: true, lastName: true, phone: true } } }
          },
          vehicle: true
        }
      });
    });

    // TODO: Notifier le client que sa course a été acceptée
    this.logger.log(`Ride ${rideId} accepted by driver ${user.driverProfile.id}`);

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
    // calcule de finance 
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

  // Si l'utilisateur n'existe pas, on lève une exception.
  if (!user) {
    throw new NotFoundException('User not found');
  }

  const ride = await this.prisma.ride.findUnique({
    where: { id: rideId },
    include: { client: true, driver: true }
  });

  if (!ride) {
    throw new NotFoundException('Ride not found');
  }

  // Vérifier que l'utilisateur a le droit d'annuler
  // On utilise l'opérateur de chaînage optionnel `?.` pour éviter les erreurs si le profil est null.
  const canCancel = 
    (user.role === UserRole.CLIENT && ride.clientId === user.clientProfile?.id) ||
    (user.role === UserRole.DRIVER && ride.driverId === user.driverProfile?.id) ||
    user.role === UserRole.ADMIN;

  if (!canCancel) {
    throw new ForbiddenException('You cannot cancel this ride');
  }

  // Vérifier que la course peut être annulée
if ((
  [RideStatus.COMPLETED, RideStatus.CANCELED] as RideStatus[]
).includes(ride.status)) {
  throw new BadRequestException('Cannot cancel a completed or already canceled ride');
}

  // Transaction d'annulation pour garantir la cohérence
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

  this.logger.log(`Ride ${rideId} canceled by ${cancelDto.canceledBy}`);
  return canceledRide;
}

// ===============================
// NOTATION D'UNE COURSE
// ===============================
async rateRide(userId: string, rideId: string, ratingDto: CreateRatingDto) {
  // 1. Récupérer l'utilisateur et son profil en une seule requête
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { clientProfile: true },
  });

  // 2. Vérifier si l'utilisateur est un client valide et s'il a un profil
  if (!user || user.role !== UserRole.CLIENT || !user.clientProfile) {
    throw new ForbiddenException('Seuls les clients peuvent évaluer les trajets.');
  }

  // 3. Récupérer la course
  const ride = await this.prisma.ride.findUnique({
    where: { id: rideId },
    include: { ratings: true, driver: true }, // Inclure les ratings et le driver pour les vérifications et mises à jour
  });

  // 4. Vérifier si la course existe
  if (!ride) {
    throw new NotFoundException('Course non trouvée');
  }

  // 5. S'assurer que le client évalue son propre trajet
  if (ride.clientId !== user.clientProfile.id) {
    throw new ForbiddenException('Vous ne pouvez évaluer que vos propres trajets');
  }

  // 6. Vérifier le statut de la course et si elle a déjà été notée
  if (ride.status !== RideStatus.COMPLETED) {
    throw new BadRequestException('Vous ne pouvez évaluer que les trajets terminés');
  }
  if (ride.ratings.length > 0) {
    throw new BadRequestException('Course déjà notée');
  }

  // 7. Exécuter la transaction pour la création de la note et la mise à jour du profil chauffeur
  const newRating = await this.prisma.$transaction(async (tx) => {
    // Créer la notation
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
      // Calculer la nouvelle moyenne en une seule requête optimisée
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

    // Filtrer selon le rôle
    if (user.role === UserRole.CLIENT && user.clientProfile) {
      whereCondition.clientId = user.clientProfile.id;
    } else if (user.role === UserRole.DRIVER && user.driverProfile) {
      whereCondition.driverId = user.driverProfile.id;
    } else {
      // Admin peut voir toutes les courses
    }

    // Filtres additionnels
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

    // Vérifier les droits d'accès
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

    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: { driver: true, vehicle: true }
    });

    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.driverId !== user.driverProfile.id) {
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
