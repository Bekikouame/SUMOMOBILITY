// src/payments/payments.service.ts
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentFilterDto } from './dto/payment-filter.dto';
import { PaymentStatus, UserRole, Prisma, ReservationStatus, RideStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // ✅ MÉTHODES WEBHOOK - Nécessaires pour PaymentWebhooksController
  
  // Trouve un paiement par son transaction ID
  async findByTransactionId(transactionId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: {
        transactionId: transactionId,
      },
      include: {
        ridePayments: {
          include: {
            ride: true,
          },
        },
        reservationPayments: {
          include: {
            reservation: true,
          },
        },
      },
    });

    return payment;
  }

  // Marque un paiement comme réussi
  async markAsSucceeded(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Paiement avec l'ID ${paymentId} non trouvé`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Mettre à jour le statut du paiement
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.SUCCEEDED,
          processedAt: new Date(),
          failureReason: null,
          processorFee: new Decimal(payment.amount.toNumber() * 0.02), // 2% de frais
          netAmount: new Decimal(payment.amount.toNumber() * 0.98),
        },
      });

      // Gérer les courses liées
      await this.handleRidePaymentSuccess(paymentId, tx);
      
      // Gérer les réservations liées
      await this.handleReservationPaymentSuccess(paymentId, tx);

      return updatedPayment;
    });
  }

  // Marque un paiement comme échoué
  async markAsFailed(paymentId: string, failureReason?: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new NotFoundException(`Paiement avec l'ID ${paymentId} non trouvé`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Mettre à jour le statut du paiement
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.FAILED,
          processedAt: new Date(),
          failureReason: failureReason || 'Échec du paiement',
        },
      });

      // Gérer l'échec du paiement
      await this.handlePaymentFailure(paymentId, tx);

      return updatedPayment;
    });
  }

  // ✅ MÉTHODES PRIVÉES POUR GÉRER LES SUCCÈS/ÉCHECS

  private async handleRidePaymentSuccess(paymentId: string, tx: any) {
    const ridePayment = await tx.ridePayment.findFirst({
      where: { paymentId },
      include: { ride: true },
    });

    if (ridePayment && ridePayment.ride.status === RideStatus.COMPLETED) {
      // Marquer la course comme payée (vous pouvez ajouter un champ isPaid dans votre schéma)
      await tx.ride.update({
        where: { id: ridePayment.rideId },
        data: {
          updatedAt: new Date(),
        },
      });

      // TODO: Notifier le chauffeur que le paiement est confirmé
      console.log(`✅ Paiement confirmé pour la course ${ridePayment.rideId}`);
    }
  }

  private async handleReservationPaymentSuccess(paymentId: string, tx: any) {
    const reservationPayment = await tx.reservationPayment.findFirst({
      where: { paymentId },
      include: { reservation: true },
    });

    if (reservationPayment && reservationPayment.reservation.status === ReservationStatus.PENDING) {
      // Confirmer la réservation
      await tx.reservation.update({
        where: { id: reservationPayment.reservationId },
        data: {
          status: ReservationStatus.CONFIRMED,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Réservation confirmée ${reservationPayment.reservationId}`);
    }
  }

  private async handlePaymentFailure(paymentId: string, tx: any) {
    // Vérifier si c'est un paiement de course
    const ridePayment = await tx.ridePayment.findFirst({
      where: { paymentId },
      include: { ride: true },
    });

    if (ridePayment) {
      await tx.ride.update({
        where: { id: ridePayment.rideId },
        data: {
          status: RideStatus.CANCELED,
          canceledAt: new Date(),
          canceledBy: 'SYSTEM',
          updatedAt: new Date(),
        },
      });
    }

    // Vérifier si c'est un paiement de réservation
    const reservationPayment = await tx.reservationPayment.findFirst({
      where: { paymentId },
      include: { reservation: true },
    });

    if (reservationPayment) {
      await tx.reservation.update({
        where: { id: reservationPayment.reservationId },
        data: {
          status: ReservationStatus.CANCELED,
          canceledAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    console.log(`❌ Paiement échoué, entités annulées pour le paiement ${paymentId}`);
  }

  // ✅ MÉTHODES EXISTANTES CORRIGÉES

  // Créer un nouveau paiement
  async createPayment(createPaymentDto: CreatePaymentDto) {
    const { rideId, reservationId, paymentType, ...paymentData } = createPaymentDto;

    // Vérifier qu'au moins une relation existe
    if (!rideId && !reservationId) {
      throw new BadRequestException('Un paiement doit être lié à une course ou une réservation');
    }

    // Vérifier l'existence de la course ou réservation
    if (rideId) {
      const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride) {
        throw new NotFoundException('Course non trouvée');
      }
    }

    if (reservationId) {
      const reservation = await this.prisma.reservation.findUnique({ where: { id: reservationId } });
      if (!reservation) {
        throw new NotFoundException('Réservation non trouvée');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Créer le paiement
      const payment = await tx.payment.create({
        data: {
          amount: new Decimal(paymentData.amount),
          currency: paymentData.currency || 'XOF',
          method: paymentData.method,
          transactionId: paymentData.transactionId,
          status: PaymentStatus.PENDING,
        },
      });

      // Créer la liaison appropriée
      if (rideId) {
        await tx.ridePayment.create({
          data: {
            rideId,
            paymentId: payment.id,
            paymentType: paymentType || 'FARE',
          },
        });
      }

      if (reservationId) {
        await tx.reservationPayment.create({
          data: {
            reservationId,
            paymentId: payment.id,
            paymentType: paymentType || 'DEPOSIT',
          },
        });
      }

      return this.findOne(payment.id);
    });
  }

  // Récupérer un paiement par ID avec relations
  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        ridePayments: {
          include: {
            ride: {
              include: {
                client: { include: { user: true } },
                driver: { include: { user: true } },
              },
            },
          },
        },
        reservationPayments: {
          include: {
            reservation: {
              include: {
                client: { include: { user: true } },
              },
            },
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException('Paiement non trouvé');
    }

    return payment;
  }

  // Lister tous les paiements avec filtres
  async findAll(filters: PaymentFilterDto) {
    const { page = 1, limit = 10, method, status, startDate, endDate, driverId } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentWhereInput = {};

    if (method) where.method = method;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (driverId) {
      where.ridePayments = {
        some: {
          ride: {
            driverId,
          },
        },
      };
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ridePayments: {
            include: {
              ride: {
                select: {
                  id: true,
                  pickupAddress: true,
                  destinationAddress: true,
                  client: { select: { user: { select: { firstName: true, lastName: true } } } },
                  driver: { select: { user: { select: { firstName: true, lastName: true } } } },
                },
              },
            },
          },
          reservationPayments: {
            include: {
              reservation: {
                select: {
                  id: true,
                  scheduledAt: true,
                  client: { select: { user: { select: { firstName: true, lastName: true } } } },
                },
              },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      data: payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ✅ CORRECTION - Paiements d'une course spécifique
  async findRidePayments(rideId: string) {
    // Récupérer les paiements via la table de liaison RidePayment
    const ridePayments = await this.prisma.ridePayment.findMany({
      where: { rideId },
      include: {
        payment: true,
      },
    });

    if (!ridePayments.length) {
      // Vérifier si la course existe
      const ride = await this.prisma.ride.findUnique({ where: { id: rideId } });
      if (!ride) {
        throw new NotFoundException('Course non trouvée');
      }
      return [];
    }

    return ridePayments.map(rp => ({
      ...rp.payment,
      paymentType: rp.paymentType,
    }));
  }

  // ✅ CORRECTION - Gains d'un chauffeur
  async getDriverEarnings(driverId: string, startDate?: string, endDate?: string) {
    // Vérifier que le chauffeur existe
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true },
    });

    if (!driver) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    const where: Prisma.RideWhereInput = {
      driverId,
      status: RideStatus.COMPLETED,
    };

    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) where.completedAt.gte = new Date(startDate);
      if (endDate) where.completedAt.lte = new Date(endDate);
    }

    // ✅ CORRECTION PRINCIPALE - Utiliser la bonne structure de relation
    const rides = await this.prisma.ride.findMany({
      where,
      include: {
        payments: {
          include: {
            payment: true,
          },
        },
      },
    });

    // Filtrer les paiements réussis après la requête
    const ridesWithSuccessfulPayments = rides.map(ride => ({
      ...ride,
      payments: ride.payments.filter(rp => rp.payment.status === PaymentStatus.SUCCEEDED),
    }));

    const totalEarnings = ridesWithSuccessfulPayments.reduce((sum, ride) => {
      const rideEarnings = ride.driverEarnings?.toNumber() || 0;
      return sum + rideEarnings;
    }, 0);

    const totalPayments = ridesWithSuccessfulPayments.reduce((sum, ride) => {
      const paymentsSum = ride.payments.reduce((pSum, rp) => {
        return pSum + rp.payment.amount.toNumber();
      }, 0);
      return sum + paymentsSum;
    }, 0);

    const totalRides = rides.length;

    return {
      driver: {
        id: driver.id,
        name: `${driver.user.firstName} ${driver.user.lastName}`,
        totalRides: driver.totalRides,
        rating: driver.rating,
      },
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
        ridesCount: totalRides,
      },
      earnings: {
        totalEarnings,
        totalPayments,
        platformFee: totalPayments - totalEarnings,
        averagePerRide: totalRides > 0 ? totalEarnings / totalRides : 0,
      },
      rides: rides.map(ride => ({
        id: ride.id,
        completedAt: ride.completedAt,
        totalFare: ride.totalFare?.toNumber() || 0,
        driverEarnings: ride.driverEarnings?.toNumber() || 0,
        platformFee: ride.platformFee?.toNumber() || 0,
        pickupAddress: ride.pickupAddress,
        destinationAddress: ride.destinationAddress,
      })),
    };
  }

  // Traiter un paiement (simulé - dans la vraie vie, intégration avec Stripe, etc.)
  async processPayment(paymentId: string) {
    const payment = await this.findOne(paymentId);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Ce paiement ne peut plus être traité');
    }

    // Simulation du traitement
    const success = Math.random() > 0.1; // 90% de succès

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: success ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED,
        processedAt: new Date(),
        failureReason: success ? null : 'Échec de la transaction bancaire',
        processorFee: success ? new Decimal(payment.amount.toNumber() * 0.02) : null, // 2% de frais
        netAmount: success ? new Decimal(payment.amount.toNumber() * 0.98) : null,
      },
    });
  }

  // Remboursement (admin only)
  async refundPayment(paymentId: string, refundDto: RefundPaymentDto, adminId: string) {
    const payment = await this.findOne(paymentId);

    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new BadRequestException('Seuls les paiements réussis peuvent être remboursés');
    }

    const refundAmount = refundDto.amount || payment.amount.toNumber();

    if (refundAmount > payment.amount.toNumber()) {
      throw new BadRequestException('Le montant du remboursement ne peut pas dépasser le montant original');
    }

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        failureReason: `Remboursement: ${refundDto.reason}`,
        processedAt: new Date(),
        netAmount: new Decimal(payment.amount.toNumber() - refundAmount),
      },
    });
  }

  // Statistiques de paiements (admin)
  async getPaymentStats(startDate?: string, endDate?: string) {
    const where: Prisma.PaymentWhereInput = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [total, succeeded, failed, refunded, pending] = await Promise.all([
      this.prisma.payment.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.SUCCEEDED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.FAILED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.REFUNDED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.payment.aggregate({
        where: { ...where, status: PaymentStatus.PENDING },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    return {
      period: { startDate: startDate || null, endDate: endDate || null },
      overview: {
        totalPayments: total._count,
        totalAmount: total._sum.amount?.toNumber() || 0,
        successRate: total._count > 0 ? (succeeded._count / total._count * 100) : 0,
      },
      byStatus: {
        succeeded: {
          count: succeeded._count,
          amount: succeeded._sum.amount?.toNumber() || 0,
        },
        failed: {
          count: failed._count,
          amount: failed._sum.amount?.toNumber() || 0,
        },
        refunded: {
          count: refunded._count,
          amount: refunded._sum.amount?.toNumber() || 0,
        },
        pending: {
          count: pending._count,
          amount: pending._sum.amount?.toNumber() || 0,
        },
      },
    };
  }
}