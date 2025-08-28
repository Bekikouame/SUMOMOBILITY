import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../prisma/prisma.service';
import { RatingCalculatorService } from '../services/rating-calculator.service';

@Injectable()
export class RatingCleanupTask {
  constructor(
    private prisma: PrismaService,
    private calculatorService: RatingCalculatorService,
  ) {}

  // Recalculer toutes les notes des chauffeurs (tous les jours à 03h00)
  @Cron('0 3 * * *')
  async recalculateAllDriverRatings() {
    console.log('🔄 Début du recalcul des notes chauffeurs...');
    
    const drivers = await this.prisma.driverProfile.findMany({
      select: { id: true },
      where: { totalRides: { gt: 0 } },
    });

    let updated = 0;
    for (const driver of drivers) {
      try {
        await this.calculatorService.updateDriverRating(driver.id);
        updated++;
      } catch (error) {
        console.error(`Erreur mise à jour chauffeur ${driver.id}:`, error);
      }
    }

    console.log(`✅ Recalcul terminé: ${updated}/${drivers.length} chauffeurs mis à jour`);
  }

  // Nettoyer les évaluations de test/spam (toutes les semaines)
  @Cron(CronExpression.EVERY_WEEK)
  async cleanupSpamRatings() {
    // Supprimer les évaluations suspectes
    const result = await this.prisma.rating.deleteMany({
      where: {
        OR: [
          { comment: { contains: 'test' } },
          { comment: { contains: 'spam' } },
          { 
            AND: [
              { comment: { not: null } },
              { comment: { equals: '' } }
            ]
          },
          // Évaluations trop anciennes sans intérêt
          {
            AND: [
              { createdAt: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
              { score: { equals: 3 } },
              { comment: null },
            ]
          }
        ],
      },
    });

    if (result.count > 0) {
      console.log(`🧹 Nettoyage: ${result.count} évaluations spam supprimées`);
    }
  }

  // Détecter les patterns anormaux (tous les jours)
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async detectAnomalies() {
    // Détecter les chauffeurs avec trop d'évaluations 5 étoiles récentes
    const suspiciousDrivers = await this.prisma.$queryRaw`
      SELECT 
        dp.id,
        u.first_name,
        u.last_name,
        COUNT(*) as recent_5_stars,
        COUNT(*) FILTER (WHERE r.score = 5) as five_star_count
      FROM driver_profiles dp
      JOIN users u ON dp.user_id = u.id
      JOIN rides ri ON ri.driver_id = dp.id
      JOIN ratings r ON r.ride_id = ri.id
      WHERE r.created_at > NOW() - INTERVAL '7 days'
      GROUP BY dp.id, u.first_name, u.last_name
      HAVING 
        COUNT(*) >= 10 
        AND COUNT(*) FILTER (WHERE r.score = 5) / COUNT(*)::float > 0.95
      ORDER BY recent_5_stars DESC
    `;

    if (Array.isArray(suspiciousDrivers) && suspiciousDrivers.length > 0) {
      console.log('🕵️ Chauffeurs suspects détectés:', suspiciousDrivers);
      // Ici vous pouvez envoyer une alerte à l'équipe de modération
    }

    // Détecter les clients qui donnent toujours de mauvaises notes
    const harshClients = await this.prisma.$queryRaw`
      SELECT 
        cp.id,
        u.first_name,
        u.last_name,
        COUNT(*) as total_ratings,
        AVG(r.score) as avg_score
      FROM client_profiles cp
      JOIN users u ON cp.user_id = u.id
      JOIN rides ri ON ri.client_id = cp.id
      JOIN ratings r ON r.ride_id = ri.id
      WHERE r.created_at > NOW() - INTERVAL '30 days'
      GROUP BY cp.id, u.first_name, u.last_name
      HAVING COUNT(*) >= 5 AND AVG(r.score) < 2.5
      ORDER BY avg_score ASC
    `;

    if (Array.isArray(harshClients) && harshClients.length > 0) {
      console.log('👀 Clients très critiques détectés:', harshClients);
    }
  }
}
