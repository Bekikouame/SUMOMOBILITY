// src/ratings/services/rating-calculator.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class RatingCalculatorService {
  constructor(private prisma: PrismaService) {}

  async updateDriverRating(driverId: string, tx?: Prisma.TransactionClient) {
    const client = tx || this.prisma;

    // Récupérer toutes les évaluations valides du chauffeur
    const ratings = await client.rating.findMany({
      where: {
        ride: { driverId },
        // Exclure les évaluations rejetées ou cachées par modération
        NOT: {
          OR: [
            { comment: '[Commentaire masqué]' },
            { comment: null, score: { lt: 1 } }, // Ratings supprimés
          ],
        },
      },
    });

    if (ratings.length === 0) {
      return client.driverProfile.update({
        where: { id: driverId },
        data: { rating: null },
      });
    }

    // Calcul de la moyenne pondérée
    const weightedAverage = this.calculateWeightedAverage(ratings);
    
    return client.driverProfile.update({
      where: { id: driverId },
      data: { rating: Math.round(weightedAverage * 10) / 10 },
    });
  }

  private calculateWeightedAverage(ratings: any[]): number {
    if (ratings.length === 0) return 0;

    // Pondération par ancienneté (les évaluations récentes ont plus de poids)
    const now = new Date().getTime();
    const maxAge = 180 * 24 * 60 * 60 * 1000; // 180 jours en milliseconds

    let totalScore = 0;
    let totalWeight = 0;

    ratings.forEach(rating => {
      const age = now - rating.createdAt.getTime();
      const ageWeight = Math.max(0.1, 1 - (age / maxAge)); // Minimum 10% de poids
      
      // Bonus pour les évaluations détaillées (avec critères)
      const detailBonus = this.hasDetailedCriteria(rating) ? 1.2 : 1.0;
      
      const weight = ageWeight * detailBonus;
      
      totalScore += rating.score * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  private hasDetailedCriteria(rating: any): boolean {
    return rating.punctuality || rating.cleanliness || rating.driving || rating.courtesy;
  }

  // Calculer le rang d'un chauffeur par rapport aux autres
  async calculateDriverRank(driverId: string): Promise<{
    rank: number;
    percentile: number;
    totalDrivers: number;
  }> {
    const [driverRating, allDriversCount, betterDriversCount] = await Promise.all([
      this.prisma.driverProfile.findUnique({
        where: { id: driverId },
        select: { rating: true },
      }),
      this.prisma.driverProfile.count({
        where: { 
          rating: { not: null },
          totalRides: { gte: 5 }, // Minimum 5 courses
        },
      }),
      // Compter les chauffeurs avec une meilleure note
      this.prisma.driverProfile.count({
        where: { 
          rating: { not: null },
          totalRides: { gte: 5 },
        },
      }),
    ]);

    if (!driverRating?.rating) {
      return { rank: allDriversCount, percentile: 0, totalDrivers: allDriversCount };
    }

    const betterCount = await this.prisma.driverProfile.count({
      where: {
        rating: { gt: driverRating.rating },
        totalRides: { gte: 5 },
      },
    });

    const rank = betterCount + 1;
    const percentile = ((allDriversCount - rank + 1) / allDriversCount) * 100;

    return {
      rank,
      percentile: Math.round(percentile * 10) / 10,
      totalDrivers: allDriversCount,
    };
  }
}
