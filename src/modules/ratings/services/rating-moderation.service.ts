import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { ModerationAction } from '../dto/moderate-rating.dto';

@Injectable()
export class RatingModerationService {
  private readonly BLOCKED_WORDS = [
    'spam', 'fake', 'insulte', 'con', 'idiot', 'stupide', 
    'arnaque', 'voleur', 'nul', 'merde', 'bordel'
  ];

  private readonly SUSPICIOUS_PATTERNS = [
    /(.)\1{4,}/, // Répétition excessive de caractères
    /^[A-Z\s!]{10,}$/, // Tout en majuscules
    /\b\d{8,}\b/, // Numéros de téléphone
    /[^\w\s.,!?'-]/g, // Caractères spéciaux suspects
  ];

  constructor(private prisma: PrismaService) {}

  async moderateComment(ratingId: string, comment: string): Promise<void> {
    if (!comment) return;

    const score = this.calculateModerationScore(comment);
    const needsReview = score > 0.5;

    await this.prisma.$executeRaw`
      INSERT INTO rating_moderation (
        rating_id, auto_score, needs_review, flagged_words, created_at
      ) VALUES (
        ${ratingId}, ${score}, ${needsReview}, 
        ${this.extractFlaggedWords(comment)}, NOW()
      )
    `;

    if (needsReview) {
      console.log(`🚨 Commentaire nécessitant une révision: Rating ${ratingId}, Score: ${score}`);
    }
  }

  async applyModeration(
    ratingId: string,
    action: ModerationAction,
    adminId: string,
    reason?: string
  ) {
    const timestamp = new Date();

    await this.prisma.$executeRaw`
      UPDATE rating_moderation 
      SET 
        status = ${action},
        reviewed_by = ${adminId},
        reviewed_at = ${timestamp},
        admin_reason = ${reason}
      WHERE rating_id = ${ratingId}
    `;

    // Cacher le commentaire si nécessaire
    if ([ModerationAction.HIDE, ModerationAction.REJECT].includes(action)) {
      await this.prisma.rating.update({
        where: { id: ratingId },
        data: { 
          comment: action === ModerationAction.HIDE ? '[Commentaire masqué]' : null 
        },
      });
    }

    return { success: true, action, timestamp };
  }

  async getPendingModerations() {
    return this.prisma.$queryRaw`
      SELECT 
        r.id,
        r.score,
        r.comment,
        r.created_at,
        rm.auto_score,
        rm.flagged_words,
        u_client.first_name as client_name,
        u_driver.first_name as driver_name,
        ride.pickup_address,
        ride.destination_address
      FROM ratings r
      JOIN rating_moderation rm ON r.id = rm.rating_id
      JOIN rides ride ON r.ride_id = ride.id
      JOIN client_profiles cp ON ride.client_id = cp.id
      JOIN users u_client ON cp.user_id = u_client.id
      LEFT JOIN driver_profiles dp ON ride.driver_id = dp.id
      LEFT JOIN users u_driver ON dp.user_id = u_driver.id
      WHERE rm.needs_review = true AND rm.status IS NULL
      ORDER BY rm.auto_score DESC, r.created_at ASC
    `;
  }

  private calculateModerationScore(comment: string): number {
    let score = 0;

    // Vérifier les mots bloqués
    const blockedWordsFound = this.BLOCKED_WORDS.filter(word => 
      comment.toLowerCase().includes(word.toLowerCase())
    );
    score += blockedWordsFound.length * 0.3;

    // Vérifier les patterns suspects
    const suspiciousPatterns = this.SUSPICIOUS_PATTERNS.filter(pattern => 
      pattern.test(comment)
    );
    score += suspiciousPatterns.length * 0.2;

    // Longueur suspecte (trop court ou trop long)
    if (comment.length < 5 || comment.length > 400) {
      score += 0.1;
    }

    // Répétition excessive
    const words = comment.split(' ');
    const uniqueWords = new Set(words);
    if (words.length > uniqueWords.size * 2) {
      score += 0.2;
    }

    return Math.min(score, 1); // Score maximum de 1
  }

  private extractFlaggedWords(comment: string): string {
    const flagged = this.BLOCKED_WORDS.filter(word => 
      comment.toLowerCase().includes(word.toLowerCase())
    );
    return JSON.stringify(flagged);
  }
}