// src/modules/rides/rides.service.ts
import { 
  Injectable, 
  NotFoundException, 
  BadRequestException, 
  ForbiddenException,
  Logger 
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RideStatus, UserRole, VehicleStatus, DriverStatus, NotificationType, DriverActivityStatus } from '@prisma/client';
import { CreateRideDto } from './dto/create-ride.dto';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { QueryRidesDto } from './dto/query-rides.dto';
import { NotificationsService } from '../notifications/services/notifications.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EstimateFareDto } from './dto/estimate-fare.dto';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { WalletService } from '../wallet/wallet.service';




type RideWithDriverProfile = Prisma.RideGetPayload<{
  include: {
    client: { include: { user: true } };
    driver: { 
      include: { 
        user: true; 
        driverProfile: true; 
      };
    };
  };
}>;

@Injectable()
export class RidesService {
  private readonly logger = new Logger(RidesService.name);

  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
    private notificationsGateway: NotificationsGateway,
    private eventEmitter: EventEmitter2,
    private walletService: WalletService
  ) {}

  
// ===============================
// CRÉATION DE COURSE
// ===============================
async createRide(userId: string, createRideDto: CreateRideDto) {
  this.logger.log(`Creating ride for user ${userId}`);

  // Validation de l'ID utilisateur
  if (!userId) {
    throw new BadRequestException("L'ID utilisateur est requis");
  }

  // Vérifier que acceptedFare est fourni
  if (!createRideDto.acceptedFare) {
    throw new BadRequestException(
      "Le prix accepté est requis. Veuillez d'abord obtenir une estimation.",
    );
  }

  // Vérifier que l'utilisateur est CLIENT
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { clientProfile: true },
  });

  if (!user) {
    throw new NotFoundException('Utilisateur non trouvé');
  }

  if (user.role !== UserRole.CLIENT || !user.clientProfile) {
    throw new BadRequestException('Seuls les clients peuvent demander une course');
  }

  // Recalculer et valider le prix accepté
  const distance = this.calculateDistance(
    createRideDto.pickupLatitude,
    createRideDto.pickupLongitude,
    createRideDto.destinationLatitude,
    createRideDto.destinationLongitude,
  );

  const serverCalculatedFare = this.calculateFare(
    distance,
    createRideDto.rideType || 'STANDARD',
  );

  // Vérifier que le prix accepté correspond au prix calculé (tolérance 5%)
  const tolerance = serverCalculatedFare * 0.05;
  if (Math.abs(createRideDto.acceptedFare - serverCalculatedFare) > tolerance) {
    throw new BadRequestException(
      `Le prix a changé. Prix calculé: ${serverCalculatedFare} FCFA, Prix reçu: ${createRideDto.acceptedFare} FCFA. Veuillez recalculer l'estimation.`,
    );
  }

  // Créer la course avec le prix validé
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
      baseFare: createRideDto.acceptedFare,
      totalFare: createRideDto.acceptedFare,
      distanceKm: distance,
    },
    include: {
      client: {
        include: {
          user: {
            select: { firstName: true, lastName: true, phone: true },
          },
        },
      },
    },
  });

  //  lancer la recherche de chauffeurs dispo + notifications + event WS
  await this.findAvailableDrivers(ride.id);

  this.logger.log(`Ride ${ride.id} created successfully`);
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
        include: { user: true },
      },
    },
  });

  if (!ride || ride.status !== RideStatus.REQUESTED) {
    return;
  }


  const allDrivers = await this.prisma.driverProfile.findMany({
    include: {
      user: { select: { id: true, firstName: true, lastName: true } },
      vehicles: true,
    },
  });

  console.log('=== 🔍 DEBUG CHAUFFEURS ===');
  console.log(`Total chauffeurs en BDD: ${allDrivers.length}`);
  
  allDrivers.forEach((driver, index) => {
    console.log(`\n--- Chauffeur ${index + 1} ---`);
    console.log(`Nom: ${driver.user.firstName} ${driver.user.lastName}`);
    console.log(`UserID: ${driver.user.id}`);
    console.log(`Status: ${driver.status}`);
    console.log(`ActivityStatus: ${driver.activityStatus}`);
    console.log(`Véhicules: ${driver.vehicles.length}`);
    
    driver.vehicles.forEach((vehicle, vIndex) => {
      console.log(`  Véhicule ${vIndex + 1}:`);
      console.log(`    - Status: ${vehicle.status}`);
      console.log(`    - Verified: ${vehicle.verified}`);
      console.log(`    - Capacity: ${vehicle.capacity}`);
    });
  });
  console.log('=========================\n');

  // Recherche chauffeurs (pour l'instant pas de filtrage géographique strict)
  const availableDrivers = await this.prisma.driverProfile.findMany({
    where: {
      status: DriverStatus.APPROVED,
      activityStatus: DriverActivityStatus.ONLINE,
      vehicles: {
        some: {
          status: VehicleStatus.AVAILABLE,
          verified: true,
          capacity: { gte: ride.passengerCount },
        },
      },
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true } },
      vehicles: {
        where: {
          status: VehicleStatus.AVAILABLE,
          verified: true,
        },
      },
    },
    take: 10,
  });

console.log(' Chauffeurs disponibles après filtres:', availableDrivers.length);
  console.log(' Filtres appliqués:');
  console.log(`  - status: ${DriverStatus.APPROVED}`);
  console.log(`  - activityStatus: ${DriverActivityStatus.ONLINE}`);
  console.log(`  - vehicle.status: ${VehicleStatus.AVAILABLE}`);
  console.log(`  - vehicle.verified: true`);
  console.log(`  - vehicle.capacity >= ${ride.passengerCount}`);

  this.logger.log(
    `Found ${availableDrivers.length} available drivers for ride ${rideId}`,
  );

  // Notifier chaque chauffeur disponible (notifications "classiques")
  for (const driver of availableDrivers.slice(0, 5)) {
    // Calculer la distance de manière sécurisée
    const distance =
      ride.pickupLatitude &&
      ride.pickupLongitude &&
      ride.destinationLatitude &&
      ride.destinationLongitude
        ? this.calculateDistance(
            ride.pickupLatitude,
            ride.pickupLongitude,
            ride.destinationLatitude,
            ride.destinationLongitude,
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
        details: `Course de ${ride.pickupAddress} vers ${ride.destinationAddress}`,
      },
      metadata: {
        rideId: ride.id,
        clientId: ride.clientId,
      },
    });
  }
 


  // construire la liste des userIds des chauffeurs ciblés (max 5)
  const targetDriverUserIds = availableDrivers.slice(0, 5).map((d) => d.user.id);

  console.log(' UserIds pour WebSocket:', targetDriverUserIds);
  console.log(' Rooms actives avant émission:', 
  );
  // Émettre un événement pour WebSocket / autres processus

const durationMinutes = ride.distanceKm
  ? Math.ceil((ride.distanceKm / 30) * 60)
  : 0;

  console.log('Chauffeurs trouvés:', availableDrivers.length);
  console.log('UserIds des chauffeurs:', targetDriverUserIds);

  // ✅ Émission immédiate au lieu d'un délai de 5 secondes
  this.logger.log('📤 Émission immédiate de ride.requested');

  this.eventEmitter.emit('ride.requested', {
    rideId: ride.id,
    clientId: ride.clientId,
    clientName: `${ride.client.user.firstName} ${ride.client.user.lastName}`,
    clientPhone: ride.client.user.phone,
    pickupAddress: ride.pickupAddress,
    destinationAddress: ride.destinationAddress,
    pickupLatitude: ride.pickupLatitude,
    pickupLongitude: ride.pickupLongitude,
    destinationLatitude: ride.destinationLatitude,
    destinationLongitude: ride.destinationLongitude,
    totalFare: ride.totalFare,
    baseFare: ride.baseFare,
    distanceKm: ride.distanceKm,
    durationMinutes: durationMinutes,
    passengerCount: ride.passengerCount,
    rideType: ride.rideType,
    notes: ride.notes,
    status: ride.status,
    requestedAt: ride.requestedAt,
    driverUserIds: targetDriverUserIds,
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

    // ✅ NOUVEAU : Vérifier le solde du wallet AVANT d'accepter
    const totalFare = ride.totalFare?.toNumber() || 0;
    const canAccept = await this.walletService.canAcceptRide(driverProfile.id, totalFare);

    if (!canAccept) {
      throw new BadRequestException(
        `Solde insuffisant. Rechargez votre wallet de ${totalFare} FCFA pour accepter cette course.`
      );
    }

    // ✅ NOUVEAU : Déduire le montant total IMMÉDIATEMENT
    await this.walletService.deductRideFare(driverProfile.id, totalFare, rideId);
    this.logger.log(`💰 ${totalFare} FCFA déduit du wallet du chauffeur ${driverProfile.id}`);

    // Transaction pour accepter la course
    const updatedRide = await this.prisma.$transaction(async (tx) => {
      // Marquer le véhicule comme en utilisation
      await tx.vehicle.update({
        where: { id: availableVehicle.id },
        data: { status: VehicleStatus.IN_USE }
      });

      // Mettre le chauffeur en course
      await tx.driverProfile.update({
        where: { id: driverProfile.id },
        data: { activityStatus: DriverActivityStatus.ON_RIDE } 
      });

      // Accepter la course
      return tx.ride.update({
        where: { id: rideId },
        data: {
          driverId: driverProfile.id,
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
    console.log('🔍 Course acceptée, préparation émission événement');
    console.log('🔍 clientId:', ride.client.user.id);
    console.log('🔍 driverId:', driverProfile.id);
    console.log('🔍 driverName:', `${user.firstName} ${user.lastName}`);

    //  ÉMETTRE L'ÉVÉNEMENT avec toutes les données nécessaires
    this.eventEmitter.emit('ride.accepted', {
      rideId,
      clientId: ride.client.user.id,
      driverId: driverProfile.id,
      driverName: `${user.firstName} ${user.lastName}`,
      vehiclePlate: updatedRide.vehicle?.plateNumber || 'N/A',
      estimatedArrival: '5-10 min', // TODO: Calculer l'arrivée estimée basée sur la position
      pickupAddress: updatedRide.pickupAddress,
      destinationAddress: updatedRide.destinationAddress,
    });

    this.logger.log(` Ride ${rideId} accepted by driver ${driverProfile.id}`);
    return updatedRide;
  }



  

  // ===============================
  // DÉMARRER UNE COURSE
  // ===============================
 async startRide(userId: string, rideId: string) {
  console.log(` === DÉMARRAGE COURSE ${rideId} PAR ${userId} ===`);
  
  //  RÉCUPÉRER LA COURSE D'ABORD
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    include: { driverProfile: true }
  });

  if (!user?.driverProfile) {
    throw new ForbiddenException('Profil chauffeur introuvable');
  }

  const ride = await this.prisma.ride.findUnique({
    where: { id: rideId },
    include: {
      driver: { include: { user: true } },
      client: { include: { user: true } },
      vehicle: true
    }
  });

  if (!ride) {
    throw new NotFoundException(`Course ${rideId} introuvable`);
  }

  console.log(` Statut actuel: ${ride.status}`);
  console.log(` Driver assigné: ${ride.driverId}`);
  console.log(` Driver appelant: ${user.driverProfile.id}`);

  //  VÉRIFIER QUE C'EST LE BON CHAUFFEUR
  if (ride.driverId !== user.driverProfile.id) {
    throw new ForbiddenException('Cette course n\'est pas assignée à vous');
  }

  //  CAS 1: DÉJÀ EN COURS → RETOURNER SANS ERREUR (idempotence)
  if (ride.status === RideStatus.IN_PROGRESS) {
    console.log(` Course déjà démarrée, on retourne la course existante`);
    this.logger.warn(`Ride ${rideId} already in progress`);
    return ride;
  }

  //  CAS 2: STATUT INVALIDE → ERREUR CLAIRE
  if (ride.status !== RideStatus.ACCEPTED) {
    throw new BadRequestException(
      `Cannot start ride with status: ${ride.status}. Expected status: ACCEPTED`
    );
  }

  console.log(` Statut correct (ACCEPTED), démarrage de la course...`);

  //  MISE À JOUR DU STATUT
  const updatedRide = await this.prisma.ride.update({
    where: { id: rideId },
    data: {
      status: RideStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
    include: this.getRideInclude()
  });

  console.log(` Course ${rideId} démarrée avec succès`);

  // NOTIFIER LE CLIENT
  if (ride.client) {
    await this.notificationsService.sendNotification({
      type: NotificationType.RIDE_STARTED,
      userId: ride.client.user.id,
      variables: {
        message: `Votre course a commencé`,
        destination: ride.destinationAddress,
        estimatedDuration: `${ride.durationMinutes || 15} minutes`,
        details: `Direction ${ride.destinationAddress}`
      },
      metadata: { rideId }
    });
  }

  // ÉMETTRE ÉVÉNEMENT WEBSOCKET
  this.eventEmitter.emit('ride.started', {
    rideId,
    clientId: ride.clientId,
    driverId: ride.driverId,
    destination: ride.destinationAddress
  });

  this.logger.log(` Ride ${rideId} started by driver ${userId}`);
  
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

      if (ride.driverId) {
        await tx.driverProfile.update({
            where: { id: ride.driverId },
            data: { activityStatus: DriverActivityStatus.ONLINE } 
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

        // ✅ NOUVEAU : Mettre à jour le wallet du chauffeur
        this.logger.log(`💰 Ajout de ${driverEarnings} FCFA au wallet du chauffeur ${ride.driverId}`);
      }

      // Mettre à jour le statut de la réservation associée si elle existe
      const associatedReservation = await tx.reservation.findFirst({
        where: { rideId: rideId }
      });

      if (associatedReservation) {
        await tx.reservation.update({
          where: { id: associatedReservation.id },
          data: { status: 'FULFILLED' }
        });
        this.logger.log(`✅ Réservation ${associatedReservation.id} marquée comme FULFILLED`);
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

    // ✅ NOUVEAU : Enregistrer la commission SUMO et les gains du chauffeur
    if (ride.driverId && driverEarnings && platformFee) {
      try {
        const totalFare = ride.totalFare?.toNumber() || 0;
        await this.walletService.recordRideCompletion(
          ride.driverId,
          totalFare,
          platformFee,
          driverEarnings,
          rideId
        );
        this.logger.log(
          `✅ Commission ${platformFee} FCFA + Gains ${driverEarnings} FCFA enregistrés pour le chauffeur ${ride.driverId}`
        );
      } catch (error) {
        this.logger.error(`❌ Erreur enregistrement wallet: ${error.message}`);
        // Ne pas bloquer la complétion de la course si le wallet échoue
      }
    }

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
  // ===============================
// ANNULER UNE COURSE (async cancelRide)
// ===============================
// async cancelRide(userId: string, rideId: string, cancelDto: CancelRideDto) {
//     // Vérifier les droits d'annulation
//     const user = await this.prisma.user.findUnique({
//       where: { id: userId },
//       include: { clientProfile: true, driverProfile: true }
//     });

//     if (!user) {
//       throw new NotFoundException('User not found');
//     }

//     // Récupérer la course. L'inclusion du driver.user est nécessaire pour la notification.
//     // L'assertion 'as any' est utilisée car le modèle 'driver' est le DriverProfile.
//     const ride = (await this.prisma.ride.findUnique({
//         where: { id: rideId },
//         include: { 
//             client: { include: { user: true } },
//             driver: { 
//                 include: { 
//                     user: true, // Inclusion nécessaire pour les notifications
//                 } 
//             }
//         }
//     })) as any; 

//     if (!ride) {
//       throw new NotFoundException('Ride not found');
//     }

//     // Vérifier que l'utilisateur a le droit d'annuler
//     const canCancel = 
//       (user.role === UserRole.CLIENT && user.clientProfile && ride.clientId === user.clientProfile.id) ||
//       (user.role === UserRole.DRIVER && user.driverProfile && ride.driverId === user.driverProfile.id) ||
//       user.role === UserRole.ADMIN;

//     if (!canCancel) {
//       throw new ForbiddenException('You cannot cancel this ride');
//     }

//     // Vérifier que la course peut être annulée
//     if ([RideStatus.COMPLETED, RideStatus.CANCELED].includes(ride.status)) {
//         throw new BadRequestException('Cannot cancel a completed or already canceled ride');
//     }

//     // Transaction d'annulation
//     const canceledRide = await this.prisma.$transaction(async (tx) => {
//       // Libérer le véhicule si un chauffeur était assigné
//       if (ride.vehicleId) {
//         await tx.vehicle.update({
//           where: { id: ride.vehicleId },
//           data: { status: VehicleStatus.AVAILABLE }
//         });
//       }

//       // Mettre à jour le statut du chauffeur
//       if (ride.driverId) {
//         await tx.driverProfile.update({
//              where: { id: ride.driverId }, 
//              data: { activityStatus: DriverActivityStatus.ONLINE } 
//         });
//       }

//       // Annuler la course
//       return tx.ride.update({
//         where: { id: rideId },
//         data: {
//           status: RideStatus.CANCELED,
//           cancellationCauseId: cancelDto.cancellationCauseId,
//           canceledBy: cancelDto.canceledBy,
//           canceledAt: new Date(),
//           notes: cancelDto.additionalReason 
//             ? `${ride.notes || ''}\nAnnulation: ${cancelDto.additionalReason}`.trim()
//             : ride.notes
//         },
//         include: this.getRideInclude()
//       });
//     });

//     // Notifier l'autre partie de l'annulation
//     // Remarque : ride.driver?.user.id fonctionne car l'inclusion driver: { include: { user: true } } est présente
//     const recipientUserId = user.role === UserRole.CLIENT 
//       ? ride.driver?.user.id 
//       : ride.client.user.id;

//     const canceledByText = user.role === UserRole.CLIENT ? 'le client' : 'le chauffeur';

//     if (recipientUserId) {
//       await this.notificationsService.sendNotification({
//         type: NotificationType.RIDE_CANCELED,
//         userId: recipientUserId,
//         variables: {
//           message: `Course annulée`,
//           canceledBy: canceledByText,
//           reason: cancelDto.additionalReason || 'Aucune raison spécifiée',
//           pickup: ride.pickupAddress,
//           destination: ride.destinationAddress,
//           details: `La course de ${ride.pickupAddress} vers ${ride.destinationAddress} a été annulée par ${canceledByText}`
//         },
//         metadata: { rideId }
//       });
//     }

//     // Émettre événement
//     this.eventEmitter.emit('ride.canceled', {
//       rideId,
//       canceledBy: canceledByText,
//       reason: cancelDto.additionalReason
//     });

//     this.logger.log(`Ride ${rideId} canceled by ${cancelDto.canceledBy}`);
//     return canceledRide;
// }


// src/modules/rides/rides.service.ts

// src/modules/rides/rides.service.ts

async cancelRide(
  rideId: string,
  cancelData: {
    cancellationCauseId?: string;
    canceledBy: string;
    additionalReason?: string;
  }
) {
  this.logger.log(`🚫 Tentative d'annulation de la course ${rideId} par ${cancelData.canceledBy}`);

  return this.prisma.$transaction(async (tx) => {
    // Récupérer la course
    const ride = await tx.ride.findUnique({
      where: { id: rideId },
      include: {
        client: { include: { user: true } },
        driver: { include: { user: true } },
        vehicle: true,
      },
    });

    if (!ride) {
      this.logger.error(`❌ Course ${rideId} non trouvée`);
      throw new BadRequestException('Course non trouvée');
    }

    this.logger.log(`📊 Statut actuel de la course: ${ride.status}`);

    // ✅ Autoriser l'annulation pour REQUESTED et ACCEPTED
    if (!['REQUESTED', 'ACCEPTED'].includes(ride.status)) {
      this.logger.error(`❌ Impossible d'annuler, statut: ${ride.status}`);
      throw new BadRequestException(
        `Impossible d'annuler une course avec le statut ${ride.status}`
      );
    }

    // Préparer les données de mise à jour
    const updateData: any = {
      status: 'CANCELED',
      canceledAt: new Date(),
      canceledBy: cancelData.canceledBy,
    };

    // ✅ Vérifier si la cause existe
    if (cancelData.cancellationCauseId) {
      const causeExists = await tx.cancellationCause.findUnique({
        where: { id: cancelData.cancellationCauseId },
      });

      if (causeExists) {
        updateData.cancellationCauseId = cancelData.cancellationCauseId;
        this.logger.log(`✅ Cause d'annulation trouvée: ${cancelData.cancellationCauseId}`);
      } else {
        this.logger.warn(`⚠️ Cause d'annulation introuvable: ${cancelData.cancellationCauseId}`);
        // On continue quand même sans la cause
      }
    }

    // Si le chauffeur avait accepté, libérer ses ressources
    if (ride.status === 'ACCEPTED' && ride.driverId) {
      this.logger.log(`🔓 Libération des ressources du chauffeur ${ride.driverId}`);

      // Libérer le véhicule
      if (ride.vehicleId) {
        await tx.vehicle.update({
          where: { id: ride.vehicleId },
          data: { status: 'AVAILABLE' },
        });
        this.logger.log(`✅ Véhicule ${ride.vehicleId} libéré`);
      }

      // Remettre le chauffeur en ligne
      await tx.driverProfile.update({
        where: { id: ride.driverId },
        data: { activityStatus: 'ONLINE' },
      });
      this.logger.log(`✅ Chauffeur ${ride.driverId} remis en ligne`);
    }

    // Annuler la course
    const updatedRide = await tx.ride.update({
      where: { id: rideId },
      data: updateData,
      include: {
        client: { include: { user: true } },
        driver: { include: { user: true } },
        vehicle: true,
      },
    });

    this.logger.log(`✅ Course ${rideId} annulée avec succès`);

    // Émettre l'événement WebSocket
    this.notificationsGateway.notifyRideCanceled({
      rideId: updatedRide.id,
      canceledBy: cancelData.canceledBy,
      reason: cancelData.additionalReason || 'Annulation',
      clientId: updatedRide.client?.user?.id,
      driverId: updatedRide.driver?.user?.id,
    });

    return updatedRide;
  });
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


// Dans rides.service.ts
async estimateFare(estimateDto: EstimateFareDto) {
  // Calculer la distance avec votre méthode existante
  const distance = this.calculateDistance(
    estimateDto.pickupLatitude,
    estimateDto.pickupLongitude,
    estimateDto.destinationLatitude,
    estimateDto.destinationLongitude
  );

  // Calculer le temps estimé (30 km/h moyenne en ville)
  const estimatedDurationMinutes = Math.ceil((distance / 30) * 60);
  const estimationId = `est_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Calculer les différents tarifs
  const fareOptions = {
    STANDARD: {
      name: 'Standard',
      price: this.calculateFare(distance, 'STANDARD'),
      description: 'Véhicule économique, confortable'
    },
    PREMIUM: {
      name: 'Premium',
      price: this.calculateFare(distance, 'PREMIUM'),
      description: 'Véhicule haut de gamme, climatisé'
    },
    VIP: {
      name: 'VIP',
      price: this.calculateFare(distance, 'VIP'),
      description: 'Véhicule de luxe avec chauffeur expérimenté'
    }
  };

  return {
    estimationId,
    distance: Math.round(distance * 10) / 10, // Arrondir à 1 décimale
    estimatedDuration: `${estimatedDurationMinutes} min`,
    fareOptions,
    calculationMethod: 'haversine' // Indiquer la méthode utilisée
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
    const baseFare = 500;
    const perKmRate = rideType === 'PREMIUM' ? 350 : rideType === 'VIP' ? 500 : 250;
    
    let finalFare = baseFare + (distanceKm * perKmRate);
    
    // Tarif minimum
    const minimumFare = 1200;
    if (finalFare < minimumFare) {
      finalFare = minimumFare;
    }
    
    // Heures de pointe (+30%)
    if (this.isPeakHour()) {
      finalFare = finalFare * 1.3;
    }
    
    // Arrondir à la dizaine la plus proche
    finalFare = Math.round(finalFare / 10) * 10;
    
    return finalFare;
}



  private isPeakHour(): boolean {
    const now = new Date();
    const hour = now.getHours();
    const minutes = now.getMinutes();
    const day = now.getDay(); // 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
    
    // Seulement Lundi à Vendredi
    if (day === 0 || day === 6) {
      return false;
    }
    
    // Matin : 6h30 - 9h30
    const isMorningPeak = (hour === 6 && minutes >= 30) || (hour >= 7 && hour < 9) || (hour === 9 && minutes <= 30);
    
    // Soir : 16h30 - 20h00
    const isEveningPeak = (hour === 16 && minutes >= 30) || (hour >= 17 && hour < 20);
    
    return isMorningPeak || isEveningPeak;
}
 
}


