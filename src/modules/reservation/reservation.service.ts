// src/reservations/reservations.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ConvertReservationDto } from './dto/convert-reservation.dto';
import { ReservationStatus, UserRole, RideStatus } from '@prisma/client';

@Injectable()
export class ReservationsService {
  constructor(private prisma: PrismaService) {}

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
        throw new NotFoundException('Profil client introuvable');
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
        client: {
          include: { user: true }
        },
        cancellationCause: true,
        ride: true,
        payments: {
          include: { payment: true }
        }
      },
      orderBy: { scheduledAt: 'asc' }
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

  // Récupérer les réservations qui approchent (pour notifications)
  async getUpcomingReservations(hoursAhead: number = 24) {
    const now = new Date();
    const futureTime = new Date(now.getTime() + (hoursAhead * 60 * 60 * 1000));

    const reservations = await this.prisma.reservation.findMany({
      where: {
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING]
        },
        scheduledAt: {
          gte: now,
          lte: futureTime
        }
      },
      include: {
        client: { include: { user: true } }
      },
      orderBy: { scheduledAt: 'asc' }
    });

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