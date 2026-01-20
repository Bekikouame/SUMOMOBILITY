// src/reservations/reservations.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ConvertReservationDto } from './dto/convert-reservation.dto';
import { ReservationStatus, UserRole, RideStatus, NotificationType, NotificationChannel } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PushNotificationsService } from '../push-notifications/push-notifications.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/services/notifications.service';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private pushNotificationsService: PushNotificationsService,
    private walletService: WalletService,
    private notificationsService: NotificationsService,
  ) {}

  // Créer une nouvelle réservation
  async create(clientId: string, createReservationDto: CreateReservationDto) {
    const { scheduledAt, pickupAddress, destinationAddress, ...rest } = createReservationDto;

    // Vérifier que la date est dans le futur
    if (new Date(scheduledAt) <= new Date()) {
      throw new BadRequestException('La date de réservation doit être dans le futur');
    }

    // Vérifier que le client existe
    const clientProfile = await this.prisma.clientProfile.findUnique({
      where: { id: clientId },
      include: { user: true }
    });

    if (!clientProfile) {
      throw new NotFoundException('Profil client introuvable');
    }

    // Calculer une estimation de prix si possible
    let estimatedPrice: number | null = null;
    if (rest.estimatedDistance) {
      // Logique de calcul de prix basée sur la distance
      // Ici c'est un exemple simple : 500 FCFA de base + 200 FCFA/km
      estimatedPrice = 500 + (rest.estimatedDistance * 200);
    }

    const reservation = await this.prisma.reservation.create({
      data: {
        clientId,
        scheduledAt: new Date(scheduledAt),
        pickupAddress,
        destinationAddress,
        estimatedPrice: estimatedPrice ? estimatedPrice : null,
        ...rest,
      },
      include: {
        client: {
          include: { user: true }
        },
        cancellationCause: true,
        payments: {
          include: { payment: true }
        }
      }
    });

    // Émettre un événement pour notifier tous les chauffeurs disponibles
    const eventPayload = {
      reservationId: reservation.id,
      clientId: reservation.clientId,
      clientName: `${clientProfile.user.firstName} ${clientProfile.user.lastName}`,
      scheduledAt: reservation.scheduledAt,
      pickupAddress: reservation.pickupAddress,
      destinationAddress: reservation.destinationAddress,
      estimatedPrice: reservation.estimatedPrice,
      passengerCount: reservation.passengerCount,
    };

    console.log('🔔 Émission événement reservation.created:', eventPayload);
    this.eventEmitter.emit('reservation.created', eventPayload);

    // 📱 Envoyer notifications à tous les chauffeurs en ligne
    try {
      // Push notification système
      await this.pushNotificationsService.notifyNewReservation(
        reservation.id,
        eventPayload.clientName,
        reservation.scheduledAt,
        reservation.pickupAddress || '',
        reservation.destinationAddress || '',
        Number(reservation.estimatedPrice) || 0,
      );

      // Notifications in-app pour tous les chauffeurs ONLINE
      const onlineDrivers = await this.prisma.driverProfile.findMany({
        where: { activityStatus: 'ONLINE' },
        select: { userId: true }
      });

      for (const driver of onlineDrivers) {
        await this.notificationsService.sendNotification({
          type: NotificationType.NEW_RESERVATION,
          userId: driver.userId,
          channels: [NotificationChannel.IN_APP],
          variables: {
            clientName: eventPayload.clientName,
            pickupAddress: reservation.pickupAddress || '',
            destinationAddress: reservation.destinationAddress || '',
            scheduledAt: reservation.scheduledAt.toISOString(),
            price: reservation.estimatedPrice?.toString() || '0'
          },
          metadata: {
            reservationId: reservation.id
          },
          priority: 2
        });
      }

      this.logger.log(`✅ Notifications envoyées à ${onlineDrivers.length} chauffeurs en ligne`);
    } catch (error) {
      console.error('⚠️ Erreur envoi notifications:', error.message);
    }

    return reservation;
  }

  // Récupérer toutes les réservations (avec filtres)
  async findAll(userId: string, userRole: UserRole, filters: any = {}) {
    const where: any = {};

    // Filtrage selon le rôle
    if (userRole === UserRole.CLIENT) {
      // Client ne voit que ses propres réservations
      const clientProfile = await this.prisma.clientProfile.findUnique({
        where: { userId }
      });
      if (!clientProfile) {
        // Retourner un tableau vide au lieu de lancer une erreur
        return [];
      }
      where.clientId = clientProfile.id;
    }
    // Les ADMIN voient toutes les réservations
    // Les DRIVER pourraient voir les réservations disponibles (logique métier à définir)

    // Filtres optionnels
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.scheduledFrom && filters.scheduledTo) {
      where.scheduledAt = {
        gte: new Date(filters.scheduledFrom),
        lte: new Date(filters.scheduledTo)
      };
    }

    const reservations = await this.prisma.reservation.findMany({
  where,
  include: {
    client: { include: { user: true } },
    cancellationCause: true,
    ride: {
      include: {
        driver: {
          include: {
            user: true,
            vehicles: true,
          },
        },
      },
    },
    payments: { include: { payment: true } },
  },
  orderBy: { scheduledAt: 'asc' },
});


    return reservations;
  }

  // Récupérer une réservation par ID
  async findOne(id: string, userId: string, userRole: UserRole) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        client: {
          include: { user: true }
        },
        cancellationCause: true,
        ride: {
          include: {
            driver: { include: { user: true } },
            vehicle: true,
            ratings: true
          }
        },
        payments: {
          include: { payment: true }
        }
      }
    });

    if (!reservation) {
      throw new NotFoundException('Réservation introuvable');
    }

    // Vérifier les droits d'accès
    if (userRole === UserRole.CLIENT) {
      const clientProfile = await this.prisma.clientProfile.findUnique({
        where: { userId }
      });
      if (!clientProfile || reservation.clientId !== clientProfile.id) {
        throw new ForbiddenException('Accès non autorisé à cette réservation');
      }
    }

    return reservation;
  }

  // Modifier une réservation
  async update(id: string, userId: string, userRole: UserRole, updateReservationDto: UpdateReservationDto) {
    const reservation = await this.findOne(id, userId, userRole);

    // Vérifier que la réservation peut être modifiée
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('Seules les réservations en attente peuvent être modifiées');
    }

    // Vérifier que le client est propriétaire (pour les clients)
    if (userRole === UserRole.CLIENT) {
      const clientProfile = await this.prisma.clientProfile.findUnique({
        where: { userId }
      });
      if (!clientProfile || reservation.clientId !== clientProfile.id) {
        throw new ForbiddenException('Vous ne pouvez modifier que vos propres réservations');
      }
    }

    // Validation de la nouvelle date si fournie
    if (updateReservationDto.scheduledAt) {
      if (new Date(updateReservationDto.scheduledAt) <= new Date()) {
        throw new BadRequestException('La nouvelle date doit être dans le futur');
      }
    }

    const updatedReservation = await this.prisma.reservation.update({
      where: { id },
      data: updateReservationDto,
      include: {
        client: {
          include: { user: true }
        },
        cancellationCause: true,
        ride: true,
        payments: {
          include: { payment: true }
        }
      }
    });

    return updatedReservation;
  }

  // Annuler une réservation
  async cancel(id: string, userId: string, userRole: UserRole, cancellationCauseId?: string) {
    const reservation = await this.findOne(id, userId, userRole);

    // Vérifier que la réservation peut être annulée
    if (reservation.status === ReservationStatus.CANCELED) {
      throw new BadRequestException('Cette réservation est déjà annulée');
    }

    if (reservation.status === ReservationStatus.FULFILLED) {
      throw new BadRequestException('Une réservation accomplie ne peut pas être annulée');
    }

    // Vérifier les droits
    if (userRole === UserRole.CLIENT) {
      const clientProfile = await this.prisma.clientProfile.findUnique({
        where: { userId }
      });
      if (!clientProfile || reservation.clientId !== clientProfile.id) {
        throw new ForbiddenException('Vous ne pouvez annuler que vos propres réservations');
      }
    }

    // Préparer les opérations de la transaction
    const updateReservationOperation = this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CANCELED,
        canceledAt: new Date(),
        cancellationCauseId
      },
      include: {
        client: { include: { user: true } },
        cancellationCause: true,
        ride: true,
        payments: { include: { payment: true } }
      }
    });

    // Si la réservation a déjà été convertie en course, annuler aussi la course
    if (reservation.rideId) {
      const updateRideOperation = this.prisma.ride.update({
        where: { id: reservation.rideId },
        data: {
          status: RideStatus.CANCELED,
          canceledAt: new Date(),
          canceledBy: userRole,
          cancellationCauseId
        }
      });

      // Exécuter les deux opérations dans une transaction
      const [updatedReservation] = await this.prisma.$transaction([
        updateReservationOperation,
        updateRideOperation
      ]);

      return updatedReservation;
    } else {
      // Seulement annuler la réservation
      const updatedReservation = await updateReservationOperation;
      return updatedReservation;
    }
  }

  // Convertir une réservation en course réelle
  async convertToRide(id: string, userId: string, userRole: UserRole, convertDto?: ConvertReservationDto) {
    const reservation = await this.findOne(id, userId, userRole);

    // Vérifications
    if (reservation.status !== ReservationStatus.CONFIRMED && reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('Seules les réservations confirmées ou en attente peuvent être converties');
    }

    if (reservation.rideId) {
      throw new BadRequestException('Cette réservation a déjà été convertie en course');
    }

    // Vérifier que c'est le bon moment (par exemple, dans les 2h avant l'heure programmée)
    const now = new Date();
    const scheduledTime = new Date(reservation.scheduledAt);
    const timeDiff = scheduledTime.getTime() - now.getTime();
    const hoursUntilScheduled = timeDiff / (1000 * 60 * 60);

    if (hoursUntilScheduled > 2) {
      throw new BadRequestException('La conversion n\'est possible que dans les 2h avant l\'heure programmée');
    }

    if (hoursUntilScheduled < -1) {
      throw new BadRequestException('Cette réservation est expirée');
    }

    // Créer la course
    const rideData = {
      clientId: reservation.clientId,
      rideType: convertDto?.rideType || 'STANDARD',
      pickupAddress: reservation.pickupAddress,
      destinationAddress: reservation.destinationAddress,
      passengerCount: reservation.passengerCount,
      notes: reservation.notes,
      requestedAt: new Date(),
      baseFare: reservation.estimatedPrice,
      totalFare: reservation.estimatedPrice,
      status: RideStatus.REQUESTED
    };

    const [ride, updatedReservation] = await this.prisma.$transaction([
      this.prisma.ride.create({
        data: rideData,
        include: {
          client: { include: { user: true } },
          driver: { include: { user: true } },
          vehicle: true,
          ratings: true,
          payments: { include: { payment: true } }
        }
      }),
      this.prisma.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.FULFILLED,
          rideId: undefined // sera mis à jour après création du ride
        }
      })
    ]);

    // Mettre à jour la réservation avec l'ID de la course
    const finalReservation = await this.prisma.reservation.update({
      where: { id },
      data: { rideId: ride.id },
      include: {
        client: { include: { user: true } },
        cancellationCause: true,
        ride: true,
        payments: { include: { payment: true } }
      }
    });

    return {
      reservation: finalReservation,
      ride
    };
  }

  // Confirmer une réservation (changement de statut)
  async confirm(id: string, userId: string, userRole: UserRole) {
    const reservation = await this.findOne(id, userId, userRole);

    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('Seules les réservations en attente peuvent être confirmées');
    }

    const updatedReservation = await this.prisma.reservation.update({
      where: { id },
      data: { status: ReservationStatus.CONFIRMED },
      include: {
        client: { include: { user: true } },
        cancellationCause: true,
        ride: true,
        payments: { include: { payment: true } }
      }
    });

    return updatedReservation;
  }

  // Accepter une réservation (chauffeur)
  async acceptReservation(id: string, userId: string) {
    // Récupérer le profil chauffeur
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { user: true }
    });

    if (!driverProfile) {
      throw new NotFoundException('Profil chauffeur introuvable');
    }

    // Vérifier que le chauffeur est approuvé
    if (driverProfile.status !== 'APPROVED') {
      throw new ForbiddenException('Seuls les chauffeurs approuvés peuvent accepter des réservations');
    }

    // Récupérer la réservation
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        client: { include: { user: true } }
      }
    });

    if (!reservation) {
      throw new NotFoundException('Réservation introuvable');
    }

    // Vérifier le statut
    if (reservation.status !== ReservationStatus.PENDING && reservation.status !== ReservationStatus.CONFIRMED) {
      throw new BadRequestException('Cette réservation ne peut plus être acceptée');
    }

    // Vérifier que la réservation n'a pas déjà un chauffeur assigné
    if (reservation.rideId) {
      const ride = await this.prisma.ride.findUnique({
        where: { id: reservation.rideId },
        include: { driver: true }
      });

      if (ride?.driverId) {
        throw new BadRequestException('Cette réservation a déjà un chauffeur assigné');
      }
    }

    // ✅ NOUVEAU : Vérifier le solde du wallet AVANT d'accepter
    const totalFare = reservation.estimatedPrice?.toNumber() || 0;
    const canAccept = await this.walletService.canAcceptRide(driverProfile.id, totalFare);

    if (!canAccept) {
      throw new BadRequestException(
        `Solde insuffisant. Rechargez votre wallet de ${totalFare} FCFA pour accepter cette réservation.`
      );
    }

    // ✅ NOUVEAU : Déduire le montant total IMMÉDIATEMENT
    await this.walletService.deductRideFare(driverProfile.id, totalFare, reservation.id);
    this.logger.log(`💰 ${totalFare} FCFA déduit du wallet du chauffeur ${driverProfile.id} pour réservation ${reservation.id}`);

    // Créer ou mettre à jour la course liée
    let ride;
    if (reservation.rideId) {
      // Mettre à jour la course existante
      ride = await this.prisma.ride.update({
        where: { id: reservation.rideId },
        data: {
          driverId: driverProfile.id,
          status: RideStatus.ACCEPTED
        },
        include: {
          client: { include: { user: true } },
          driver: { include: { user: true } },
          vehicle: true
        }
      });
    } else {
      // Créer une nouvelle course
      ride = await this.prisma.ride.create({
        data: {
          clientId: reservation.clientId,
          driverId: driverProfile.id,
          rideType: 'STANDARD',
          pickupAddress: reservation.pickupAddress,
          destinationAddress: reservation.destinationAddress,
          pickupLatitude: reservation.pickupLatitude,
          pickupLongitude: reservation.pickupLongitude,
          destinationLatitude: reservation.destinationLatitude,
          destinationLongitude: reservation.destinationLongitude,
          passengerCount: reservation.passengerCount,
          notes: reservation.notes,
          requestedAt: new Date(),
          baseFare: reservation.estimatedPrice,
          totalFare: reservation.estimatedPrice,
          status: RideStatus.ACCEPTED,
          distanceKm: reservation.estimatedDistance
        },
        include: {
          client: { include: { user: true } },
          driver: { include: { user: true } },
          vehicle: true
        }
      });
    }

    // Mettre à jour la réservation
    const updatedReservation = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CONFIRMED,
        rideId: ride.id
      },
      include: {
        client: { include: { user: true } },
        cancellationCause: true,
        ride: {
          include: {
            driver: { include: { user: true } },
            vehicle: true
          }
        },
        payments: { include: { payment: true } }
      }
    });

    // 📱 Notifier le client que sa réservation a été acceptée
    try {
      const driverName = `${driverProfile.user.firstName} ${driverProfile.user.lastName}`;

      // Push notification système
      await this.pushNotificationsService.notifyReservationAccepted(
        reservation.client.userId,
        driverName,
        reservation.id
      );

      // Notification in-app (pour la cloche)
      await this.notificationsService.sendNotification({
        type: NotificationType.RESERVATION_CONFIRMED,
        userId: reservation.client.userId,
        channels: [NotificationChannel.IN_APP],
        variables: {
          driverName,
          pickupAddress: reservation.pickupAddress,
          destinationAddress: reservation.destinationAddress,
          scheduledAt: reservation.scheduledAt.toISOString(),
          price: reservation.estimatedPrice?.toString() || '0'
        },
        metadata: {
          reservationId: reservation.id,
          rideId: ride.id
        },
        priority: 2
      });

      this.logger.log(`✅ Notifications envoyées au client ${reservation.client.userId}`);
    } catch (error) {
      this.logger.log('⚠️ Erreur envoi notifications acceptation réservation:', error.message);
    }

    return {
      reservation: updatedReservation,
      ride
    };
  }

  // Récupérer les réservations qui approchent (pour notifications et rappels chauffeur)
  async getUpcomingReservations(hoursAhead: number = 24) {
    const now = new Date();
    const futureTime = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000));

    this.logger.log(`📅 Recherche réservations: de ${now.toISOString()} à ${futureTime.toISOString()}`);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING]
        },
        scheduledAt: {
          gte: now,
          lte: futureTime
        },
        // ✅ Exclure les covoiturages (ils ont leur propre écran)
        isSharedRide: false,

      },
      include: {
        client: { include: { user: true } },
        ride: {
          include: {
            driver: {
              include: {
                user: true,
                vehicles: true,
              }
            }
          }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    this.logger.log(`📅 Réservations trouvées: ${reservations.length}`);
    return reservations;
  }

  // Récupérer TOUTES les réservations en attente (sans filtre de date)
  async getPendingReservations() {
    this.logger.log(`📅 Recherche TOUTES les réservations en attente...`);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING]
        },
        // Exclure les covoiturages
       isSharedRide: false,

        // Exclure les réservations déjà assignées à un chauffeur
        ride: null,
      },
      include: {
        client: { include: { user: true } },
      },
      orderBy: { scheduledAt: 'asc' }
    });

    this.logger.log(`📅 Réservations en attente trouvées: ${reservations.length}`);
    return reservations;
  }

  // Récupérer les statistiques des réservations
  async getStats(userId?: string, userRole?: UserRole) {
    const where: any = {};
    
    if (userRole === UserRole.CLIENT && userId) {
      const clientProfile = await this.prisma.clientProfile.findUnique({
        where: { userId }
      });
      if (clientProfile) {
        where.clientId = clientProfile.id;
      }
    }

    const [
      total,
      pending,
      confirmed,
      fulfilled,
      canceled,
      totalEarnings
    ] = await Promise.all([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.count({ 
        where: { ...where, status: ReservationStatus.PENDING } 
      }),
      this.prisma.reservation.count({ 
        where: { ...where, status: ReservationStatus.CONFIRMED } 
      }),
      this.prisma.reservation.count({ 
        where: { ...where, status: ReservationStatus.FULFILLED } 
      }),
      this.prisma.reservation.count({ 
        where: { ...where, status: ReservationStatus.CANCELED } 
      }),
      this.prisma.reservation.aggregate({
        where: { 
          ...where, 
          status: ReservationStatus.FULFILLED,
          estimatedPrice: { not: null }
        },
        _sum: { estimatedPrice: true }
      })
    ]);

    return {
      total,
      byStatus: {
        pending,
        confirmed,
        fulfilled,
        canceled
      },
      totalEarnings: totalEarnings._sum.estimatedPrice || 0,
      conversionRate: total > 0 ? Math.round((fulfilled / total) * 100) : 0
    };
  }
}