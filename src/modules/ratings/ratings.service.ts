import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingFilterDto } from './dto/rating-filter.dto';
import { ModerateRatingDto, ModerationAction } from './dto/moderate-rating.dto';
import { RatingModerationService } from '../ratings/services/rating-moderation.service';
import { RatingCalculatorService } from './services/rating-calculator.service';
import { RatingNotificationService } from '../ratings/services/rating-notification.service';
import { Prisma, UserRole } from '@prisma/client';

@Injectable()
export class RatingsService {
  constructor(
    private prisma: PrismaService,
    private moderationService: RatingModerationService,
    private calculatorService: RatingCalculatorService,
    private notificationService: RatingNotificationService,
  ) {}

  // Créer une nouvelle évaluation
  async createRating(createRatingDto: CreateRatingDto, userId: string) {
    const { rideId, ...ratingData } = createRatingDto;

    // Vérifier que la course existe et est terminée
    const ride = await this.prisma.ride.findUnique({
      where: { id: rideId },
      include: {
        client: { include: { user: true } },
        driver: { include: { user: true } },
        ratings: true,
      },
    });

    if (!ride) {
      throw new NotFoundException('Course non trouvée');
    }

    if (ride.status !== 'COMPLETED') {
      throw new BadRequestException('Seules les courses terminées peuvent être évaluées');
    }

    // Vérifier que l'utilisateur est le client de cette course
    if (ride.client.userId !== userId) {
      throw new ForbiddenException('Vous ne pouvez évaluer que vos propres courses');
    }

    // Vérifier qu'il n'y a pas déjà d'évaluation
    if (ride.ratings.length > 0) {
      throw new BadRequestException('Cette course a déjà été évaluée');
    }

    return this.prisma.$transaction(async (tx) => {
      // Créer l'évaluation
      const rating = await tx.rating.create({
        data: {
          rideId,
          score: ratingData.score,
          comment: ratingData.comment,
          punctuality: ratingData.punctuality,
          cleanliness: ratingData.cleanliness,
          driving: ratingData.driving,
          courtesy: ratingData.courtesy,
        },
        include: {
          ride: {
            include: {
              client: { include: { user: true } },
              driver: { include: { user: true } },
            },
          },
        },
      });

      // Modération automatique du commentaire
      if (rating.comment) {
        await this.moderationService.moderateComment(rating.id, rating.comment);
      }

      // Mettre à jour les statistiques du chauffeur
      if (ride.driverId) {
        await this.calculatorService.updateDriverRating(ride.driverId, tx);
      }

      // Envoyer notification au chauffeur
      await this.notificationService.notifyNewRating(rating);

      return rating;
    });
  }

  // Récupérer les évaluations d'une course
  async getRideRatings(rideId: string) {
    const ratings = await this.prisma.rating.findMany({
      where: { rideId },
      include: {
        ride: {
          include: {
            client: { 
              include: { 
                user: { 
                  select: { firstName: true, lastName: true } 
                } 
              } 
            },
            driver: { 
              include: { 
                user: { 
                  select: { firstName: true, lastName: true } 
                } 
              } 
            },
          },
        },
      },
    });

    return ratings.map(rating => ({
      ...rating,
      clientName: `${rating.ride.client.user.firstName} ${rating.ride.client.user.lastName.charAt(0)}.`,
      driverName: `${rating.ride.driver?.user.firstName} ${rating.ride.driver?.user.lastName}`,
    }));
  }

  // Statistiques d'un chauffeur
  async getDriverStats(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { 
        user: true,
        rides: {
          include: { ratings: true },
          where: { status: 'COMPLETED' },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    const ratings = driver.rides.flatMap(ride => ride.ratings);
    
    if (ratings.length === 0) {
      return {
        driver: {
          id: driver.id,
          name: `${driver.user.firstName} ${driver.user.lastName}`,
          totalRides: driver.totalRides,
        },
        ratingsCount: 0,
        averageScore: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        criteria: {
          punctuality: 0,
          cleanliness: 0,
          driving: 0,
          courtesy: 0,
        },
        recentRatings: [],
      };
    }

    const averageScore = ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length;
    
    const distribution = ratings.reduce((acc, r) => {
      acc[r.score] = (acc[r.score] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const criteriaAverages = {
      punctuality: this.calculateCriteriaAverage(ratings, 'punctuality'),
      cleanliness: this.calculateCriteriaAverage(ratings, 'cleanliness'),
      driving: this.calculateCriteriaAverage(ratings, 'driving'),
      courtesy: this.calculateCriteriaAverage(ratings, 'courtesy'),
    };

    const recentRatings = ratings
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        score: r.score,
        comment: r.comment,
        createdAt: r.createdAt,
        punctuality: r.punctuality,
        cleanliness: r.cleanliness,
        driving: r.driving,
        courtesy: r.courtesy,
      }));

    return {
      driver: {
        id: driver.id,
        name: `${driver.user.firstName} ${driver.user.lastName}`,
        totalRides: driver.totalRides,
        currentRating: driver.rating,
      },
      ratingsCount: ratings.length,
      averageScore: Math.round(averageScore * 10) / 10,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, ...distribution },
      criteria: criteriaAverages,
      recentRatings,
    };
  }

  // Historique des notes données par un client
  async getClientRatingHistory(clientId: string, filters: RatingFilterDto) {
    const { page = 1, limit = 10, minScore, maxScore, startDate, endDate } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.RatingWhereInput = {
      ride: { clientId },
    };

    if (minScore !== undefined || maxScore !== undefined) {
      where.score = {};
      if (minScore) where.score.gte = minScore;
      if (maxScore) where.score.lte = maxScore;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [ratings, total] = await Promise.all([
      this.prisma.rating.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ride: {
            include: {
              driver: { include: { user: true } },
            },
          },
        },
      }),
      this.prisma.rating.count({ where }),
    ]);

    return {
      data: ratings.map(rating => ({
        id: rating.id,
        score: rating.score,
        comment: rating.comment,
        createdAt: rating.createdAt,
        criteria: {
          punctuality: rating.punctuality,
          cleanliness: rating.cleanliness,
          driving: rating.driving,
          courtesy: rating.courtesy,
        },
        ride: {
          id: rating.ride.id,
          pickupAddress: rating.ride.pickupAddress,
          destinationAddress: rating.ride.destinationAddress,
          completedAt: rating.ride.completedAt,
        },
        driver: {
          name: `${rating.ride.driver?.user.firstName} ${rating.ride.driver?.user.lastName}`,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Lister toutes les évaluations avec filtres (Admin)
  async findAll(filters: RatingFilterDto) {
    const { page = 1, limit = 10, driverId, clientId, minScore, maxScore, startDate, endDate } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.RatingWhereInput = {};

    // Construction conditionnelle du filtre ride
if (driverId || clientId) {
  where.ride = {};
  
  if (driverId) {
    where.ride.driverId = driverId;
  }
  
  if (clientId) {
    where.ride.clientId = clientId;
  }
}
    if (minScore !== undefined || maxScore !== undefined) {
      where.score = {};
      if (minScore) where.score.gte = minScore;
      if (maxScore) where.score.lte = maxScore;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [ratings, total] = await Promise.all([
      this.prisma.rating.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ride: {
            include: {
              client: { include: { user: { select: { firstName: true, lastName: true } } } },
              driver: { include: { user: { select: { firstName: true, lastName: true } } } },
            },
          },
        },
      }),
      this.prisma.rating.count({ where }),
    ]);

    return {
      data: ratings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // Modérer une évaluation (Admin)
  async moderateRating(ratingId: string, moderationDto: ModerateRatingDto, adminId: string) {
    const rating = await this.prisma.rating.findUnique({
      where: { id: ratingId },
    });

    if (!rating) {
      throw new NotFoundException('Évaluation non trouvée');
    }

    // Appliquer la modération
    const result = await this.moderationService.applyModeration(
      ratingId,
      moderationDto.action,
      adminId,
      moderationDto.reason,
    );

    // Si l'évaluation est rejetée ou cachée, recalculer les stats du chauffeur
    if ([ModerationAction.REJECT, ModerationAction.HIDE].includes(moderationDto.action)) {
      const rideWithDriver = await this.prisma.ride.findUnique({
        where: { id: rating.rideId },
        select: { driverId: true },
      });

      if (rideWithDriver?.driverId) {
        await this.calculatorService.updateDriverRating(rideWithDriver.driverId);
      }
    }

    return result;
  }

  // Récupérer les évaluations en attente de modération (Admin)
  async getPendingModerations() {
    return this.moderationService.getPendingModerations();
  }

  // Statistiques globales des évaluations (Admin)
  async getGlobalStats(startDate?: string, endDate?: string) {
    const where: Prisma.RatingWhereInput = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [
      totalRatings,
      averageScore,
      distribution,
      topDrivers,
      recentTrends,
    ] = await Promise.all([
      this.prisma.rating.count({ where }),
      this.prisma.rating.aggregate({
        where,
        _avg: { score: true },
      }),
      this.prisma.rating.groupBy({
        by: ['score'],
        where,
        _count: true,
        orderBy: { score: 'asc' },
      }),
      this.getTopDrivers(5, startDate, endDate),
      this.getRecentTrends(7), // 7 derniers jours
    ]);

    return {
      period: { startDate: startDate || null, endDate: endDate || null },
      overview: {
        totalRatings,
        averageScore: Math.round((averageScore._avg.score || 0) * 10) / 10,
        distributionPercentage: this.calculateDistributionPercentages(distribution, totalRatings),
      },
      topDrivers,
      trends: recentTrends,
    };
  }

  // Utilitaires privées
  private calculateCriteriaAverage(ratings: any[], criteria: string): number {
    const validRatings = ratings.filter(r => r[criteria] !== null);
    if (validRatings.length === 0) return 0;
    
    const sum = validRatings.reduce((acc, r) => acc + r[criteria], 0);
    return Math.round((sum / validRatings.length) * 10) / 10;
  }

  private async getTopDrivers(limit: number, startDate?: string, endDate?: string) {
    // Requête complexe pour obtenir les meilleurs chauffeurs
    const drivers = await this.prisma.driverProfile.findMany({
      where: {
        rating: { not: null },
        totalRides: { gte: 5 }, // Minimum 5 courses
      },
      orderBy: [
        { rating: 'desc' },
        { totalRides: 'desc' },
      ],
      take: limit,
      include: {
        user: { select: { firstName: true, lastName: true } },
      },
    });

    return drivers.map(driver => ({
      id: driver.id,
      name: `${driver.user.firstName} ${driver.user.lastName}`,
      rating: driver.rating,
      totalRides: driver.totalRides,
    }));
  }

  private async getRecentTrends(days: number) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await this.prisma.rating.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: startDate },
      },
      _avg: { score: true },
      _count: true,
      orderBy: { createdAt: 'asc' },
    });

    return trends.map(trend => ({
      date: trend.createdAt.toISOString().split('T')[0],
      averageScore: Math.round((trend._avg.score || 0) * 10) / 10,
      ratingsCount: trend._count,
    }));
  }

  private calculateDistributionPercentages(distribution: any[], total: number) {
    const result = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    distribution.forEach(d => {
      result[d.score] = Math.round((d._count / total) * 100 * 10) / 10;
    });

    return result;
  }
}