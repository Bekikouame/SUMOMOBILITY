// src/modules/wallet/wallet.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddPaymentMethodDto } from './dto/add-payment-method.dto';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import {
  PaymentMethodType,
  WalletTransactionType,
  WalletTransactionStatus,
  WalletTransaction,
  Prisma,
} from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private prisma: PrismaService) {}

  // Obtenir ou créer le portefeuille d'un chauffeur
  async getOrCreateWallet(driverId: string) {
    let wallet = await this.prisma.wallet.findUnique({
      where: { driverId },
      include: {
        driver: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          driverId,
        },
        include: {
          driver: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });
    }

    return wallet;
  }

  // Obtenir le solde du portefeuille
  async getBalance(driverId: string) {
    const wallet = await this.getOrCreateWallet(driverId);

    return {
      balance: wallet.balance.toNumber(),
      pendingBalance: wallet.pendingBalance.toNumber(),
      currency: wallet.currency,
      lastUpdated: wallet.updatedAt.toISOString(),
    };
  }

  // Obtenir les transactions
  async getTransactions(driverId: string, filters: GetTransactionsDto) {
    const wallet = await this.getOrCreateWallet(driverId);
    const { page = 1, limit = 20, type, status, startDate, endDate } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.WalletTransactionWhereInput = {
      walletId: wallet.id,
    };

    if (type) where.type = type;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [transactions, total] = await Promise.all([
      this.prisma.walletTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.walletTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount.toNumber(),
        currency: t.currency,
        status: t.status,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
        processedAt: t.processedAt?.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Obtenir les statistiques de gains
  async getEarningsStats(driverId: string, period: 'today' | 'week' | 'month') {
    const wallet = await this.getOrCreateWallet(driverId);
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Gains totaux de la période
    const earnings = await this.prisma.walletTransaction.aggregate({
      where: {
        walletId: wallet.id,
        type: WalletTransactionType.EARNING,
        status: WalletTransactionStatus.COMPLETED,
        createdAt: { gte: startDate },
      },
      _sum: { amount: true },
      _count: true,
    });

    // Courses terminées dans la période
    const completedRides = await this.prisma.ride.count({
      where: {
        driverId,
        status: 'COMPLETED',
        completedAt: { gte: startDate },
      },
    });

    // Calculer le temps connecté (simplifié - peut être amélioré)
    const timeConnected = Math.floor(Math.random() * 480); // TODO: implémenter le vrai calcul

    return {
      totalEarnings: earnings._sum.amount?.toNumber() || 0,
      completedRides,
      averageEarning:
        completedRides > 0
          ? (earnings._sum.amount?.toNumber() || 0) / completedRides
          : 0,
      timeConnected, // en minutes
    };
  }

  // Ajouter une méthode de paiement
  async addPaymentMethod(driverId: string, dto: AddPaymentMethodDto) {
    const wallet = await this.getOrCreateWallet(driverId);

    // Si c'est la méthode par défaut, retirer le statut des autres
    if (dto.isDefault) {
      await this.prisma.driverPaymentMethod.updateMany({
        where: {
          walletId: wallet.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      });
    }

    // Créer le label selon le type
    let label = '';
    let cardLast4: string | undefined;
    let cardBrand: string | undefined;

    if (dto.type === PaymentMethodType.CARD) {
      cardLast4 = dto.cardNumber?.slice(-4);
      cardBrand = this.detectCardBrand(dto.cardNumber || '');
      label = `${cardBrand} ****${cardLast4}`;
    } else if (dto.type === PaymentMethodType.WAVE) {
      label = `Wave ${dto.phoneNumber}`;
    } else if (dto.type === PaymentMethodType.ORANGE_MONEY) {
      label = `Orange Money ${dto.phoneNumber}`;
    } else if (dto.type === PaymentMethodType.BANK_ACCOUNT) {
      label = `${dto.bankName} - ${dto.accountNumber}`;
    }

    const method = await this.prisma.driverPaymentMethod.create({
      data: {
        walletId: wallet.id,
        type: dto.type,
        label,
        cardLast4,
        cardBrand,
        cardExpiryMonth: dto.expiryMonth,
        cardExpiryYear: dto.expiryYear,
        phoneNumber: dto.phoneNumber,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        accountHolder: dto.accountHolderName,
        isDefault: dto.isDefault || false,
      },
    });

    return {
      id: method.id,
      type: method.type,
      label: method.label,
      last4: method.cardLast4,
      phoneNumber: method.phoneNumber,
      accountNumber: method.accountNumber,
      isDefault: method.isDefault,
      createdAt: method.createdAt.toISOString(),
    };
  }

  // Obtenir les méthodes de paiement
  async getPaymentMethods(driverId: string) {
    const wallet = await this.getOrCreateWallet(driverId);

    const methods = await this.prisma.driverPaymentMethod.findMany({
      where: {
        walletId: wallet.id,
        isActive: true,
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });

    return methods.map((m) => ({
      id: m.id,
      type: m.type,
      label: m.label,
      last4: m.cardLast4,
      phoneNumber: m.phoneNumber,
      accountNumber: m.accountNumber,
      isDefault: m.isDefault,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  // Supprimer une méthode de paiement
  async removePaymentMethod(driverId: string, methodId: string) {
    const wallet = await this.getOrCreateWallet(driverId);

    const method = await this.prisma.driverPaymentMethod.findFirst({
      where: {
        id: methodId,
        walletId: wallet.id,
      },
    });

    if (!method) {
      throw new NotFoundException('Méthode de paiement non trouvée');
    }

    await this.prisma.driverPaymentMethod.update({
      where: { id: methodId },
      data: { isActive: false },
    });

    return { message: 'Méthode de paiement supprimée' };
  }

  // Définir une méthode comme par défaut
  async setDefaultPaymentMethod(driverId: string, methodId: string) {
    const wallet = await this.getOrCreateWallet(driverId);

    const method = await this.prisma.driverPaymentMethod.findFirst({
      where: {
        id: methodId,
        walletId: wallet.id,
        isActive: true,
      },
    });

    if (!method) {
      throw new NotFoundException('Méthode de paiement non trouvée');
    }

    await this.prisma.$transaction([
      // Retirer le statut par défaut des autres
      this.prisma.driverPaymentMethod.updateMany({
        where: {
          walletId: wallet.id,
          isDefault: true,
        },
        data: {
          isDefault: false,
        },
      }),
      // Définir celle-ci comme par défaut
      this.prisma.driverPaymentMethod.update({
        where: { id: methodId },
        data: { isDefault: true },
      }),
    ]);

    return { message: 'Méthode par défaut mise à jour' };
  }

  // Demander un retrait
  async requestWithdrawal(driverId: string, dto: RequestWithdrawalDto) {
    const wallet = await this.getOrCreateWallet(driverId);

    // Vérifier le solde
    if (wallet.balance.toNumber() < dto.amount) {
      throw new BadRequestException('Solde insuffisant');
    }

    // Vérifier la méthode de paiement
    const method = await this.prisma.driverPaymentMethod.findFirst({
      where: {
        id: dto.paymentMethodId,
        walletId: wallet.id,
        isActive: true,
      },
    });

    if (!method) {
      throw new NotFoundException('Méthode de paiement non trouvée');
    }

    // Créer la transaction de retrait
    const transaction = await this.prisma.$transaction(async (tx) => {
      // Déduire du solde
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: new Decimal(dto.amount) },
          totalWithdrawn: { increment: new Decimal(dto.amount) },
        },
      });

      // Créer la transaction
      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.WITHDRAWAL,
          amount: new Decimal(dto.amount),
          status: WalletTransactionStatus.PENDING,
          description: `Retrait vers ${method.label}`,
          withdrawalMethodId: method.id,
          metadata: dto.note ? { note: dto.note } : undefined,
        },
      });
    });

    // TODO: Déclencher le processus de retrait avec l'API externe (Wave, Orange Money, etc.)
    // Pour l'instant, on simule un succès
    setTimeout(async () => {
      await this.prisma.walletTransaction.update({
        where: { id: transaction.id },
        data: {
          status: WalletTransactionStatus.COMPLETED,
          processedAt: new Date(),
        },
      });
    }, 5000);

    return {
      id: transaction.id,
      type: transaction.type,
      amount: transaction.amount.toNumber(),
      status: transaction.status,
      description: transaction.description,
      createdAt: transaction.createdAt.toISOString(),
    };
  }

  // Ajouter des gains (appelé après une course réussie)
  async addEarnings(driverId: string, amount: number, rideId: string, description: string) {
    const wallet = await this.getOrCreateWallet(driverId);

    const transaction = await this.prisma.$transaction(async (tx) => {
      // Ajouter au solde en attente (sera transféré au solde disponible après validation)
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: { increment: new Decimal(amount) },
          totalEarned: { increment: new Decimal(amount) },
        },
      });

      // Créer la transaction
      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.EARNING,
          amount: new Decimal(amount),
          status: WalletTransactionStatus.PENDING,
          description,
          rideId,
        },
      });
    });

    // Transférer vers le solde disponible après 24h (simulation)
    setTimeout(async () => {
      await this.prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: new Decimal(amount) },
            pendingBalance: { decrement: new Decimal(amount) },
          },
        });

        await tx.walletTransaction.update({
          where: { id: transaction.id },
          data: {
            status: WalletTransactionStatus.COMPLETED,
            processedAt: new Date(),
          },
        });
      });
    }, 1000 * 60); // 1 minute pour la demo (24h en production)

    return transaction;
  }

  // Utilitaire pour détecter la marque de carte
  private detectCardBrand(cardNumber: string): string {
    const number = cardNumber.replace(/\s/g, '');
    if (number.startsWith('4')) return 'Visa';
    if (number.startsWith('5')) return 'MasterCard';
    if (number.startsWith('3')) return 'American Express';
    return 'Carte';
  }

  // =====================================================
  // NOUVEAU FLUX - DÉDUCTION AUTOMATIQUE PAR COURSE
  // =====================================================

  /**
   * Vérifier si le chauffeur a assez de solde pour accepter une course
   */
  async canAcceptRide(driverId: string, rideAmount: number): Promise<boolean> {
    const wallet = await this.getOrCreateWallet(driverId);
    return wallet.balance.toNumber() >= rideAmount;
  }

  /**
   * Déduire le montant total de la course du wallet du chauffeur
   * Appelé IMMÉDIATEMENT quand le chauffeur ACCEPTE la course
   */
  async deductRideFare(
    driverId: string,
    totalFare: number,
    rideId: string,
  ): Promise<void> {
    const wallet = await this.getOrCreateWallet(driverId);

    // Vérifier le solde
    if (wallet.balance.toNumber() < totalFare) {
      throw new BadRequestException(
        `Solde insuffisant. Rechargez votre wallet de ${totalFare} FCFA pour accepter cette course.`,
      );
    }

    // Déduire le montant total de la course
    await this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: new Decimal(totalFare) },
        },
      });

      // Créer une transaction de déduction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.PAYMENT,
          amount: new Decimal(totalFare),
          status: WalletTransactionStatus.COMPLETED,
          description: `Déduction course #${rideId.substring(0, 8)} - ${totalFare} FCFA`,
          rideId,
        },
      });
    });

    this.logger.log(
      `💰 Déduction de ${totalFare} FCFA du wallet du chauffeur ${driverId}`,
    );
  }

  /**
   * Enregistrer la commission et les gains du chauffeur
   * Appelé quand la course est TERMINÉE
   */
  async recordRideCompletion(
    driverId: string,
    totalFare: number,
    platformFee: number,
    driverEarnings: number,
    rideId: string,
  ): Promise<void> {
    const wallet = await this.getOrCreateWallet(driverId);

    await this.prisma.$transaction(async (tx) => {
      // 1. Enregistrer la commission SUMO (15%)
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.COMMISSION,
          amount: new Decimal(platformFee),
          status: WalletTransactionStatus.COMPLETED,
          description: `Commission SUMO (15%) - Course #${rideId.substring(0, 8)}`,
          rideId,
        },
      });

      // 2. Enregistrer les gains du chauffeur (85%) dans pendingBalance
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          pendingBalance: { increment: new Decimal(driverEarnings) },
          totalEarned: { increment: new Decimal(driverEarnings) },
        },
      });

      // 3. Créer une transaction de gains
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.EARNING,
          amount: new Decimal(driverEarnings),
          status: WalletTransactionStatus.PENDING,
          description: `Gains de la course #${rideId.substring(0, 8)} (85%)`,
          rideId,
        },
      });
    });

    this.logger.log(
      `✅ Commission ${platformFee} FCFA + Gains ${driverEarnings} FCFA enregistrés pour le chauffeur ${driverId}`,
    );

    // Transférer les gains de pending vers disponible après 24h
    setTimeout(async () => {
      await this.prisma.$transaction(async (tx) => {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            balance: { increment: new Decimal(driverEarnings) },
            pendingBalance: { decrement: new Decimal(driverEarnings) },
          },
        });

        // Mettre à jour le statut de la transaction de gains
        const earningTransaction = await tx.walletTransaction.findFirst({
          where: {
            walletId: wallet.id,
            rideId,
            type: WalletTransactionType.EARNING,
          },
        });

        if (earningTransaction) {
          await tx.walletTransaction.update({
            where: { id: earningTransaction.id },
            data: {
              status: WalletTransactionStatus.COMPLETED,
              processedAt: new Date(),
            },
          });
        }
      });
    }, 1000 * 60); // 1 minute pour la demo (24h en production)
  }

  /**
   * Recharger le wallet du chauffeur via Wave/Orange Money
   * TODO: Intégrer les API Wave et Orange Money
   */
  async rechargeWallet(
    driverId: string,
    amount: number,
    paymentMethodId: string,
    note?: string,
  ): Promise<WalletTransaction> {
    const wallet = await this.getOrCreateWallet(driverId);

    // Vérifier la méthode de paiement
    const method = await this.prisma.driverPaymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        walletId: wallet.id,
        isActive: true,
      },
    });

    if (!method) {
      throw new NotFoundException('Méthode de paiement non trouvée');
    }

    // TODO: Appeler l'API Wave/Orange Money pour initier le rechargement
    // Pour l'instant, on crédite directement (simulation)

    const transaction = await this.prisma.$transaction(async (tx) => {
      // Créditer le wallet immédiatement (en production, attendre callback Wave/OM)
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: new Decimal(amount) },
        },
      });

      // Créer la transaction
      return tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTransactionType.PAYMENT,
          amount: new Decimal(amount),
          status: WalletTransactionStatus.COMPLETED, // En production: PENDING jusqu'au callback
          description: note || `Rechargement via ${method.label}`,
          metadata: { paymentMethodId, note },
        },
      });
    });

    this.logger.log(
      `💳 Rechargement de ${amount} FCFA effectué pour le chauffeur ${driverId}`,
    );

    return transaction;
  }
}
