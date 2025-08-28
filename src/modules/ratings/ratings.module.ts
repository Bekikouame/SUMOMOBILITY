import { Module } from '@nestjs/common';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { RatingModerationService } from '../ratings/services/rating-moderation.service';
import { RatingCalculatorService } from './services/rating-calculator.service';
import { RatingNotificationService } from './services/rating-notification.service';
import { RatingCleanupTask } from './tasks/rating-cleanup.task';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RatingsController],
  providers: [
    RatingsService,
    RatingModerationService,
    RatingCalculatorService,
    RatingNotificationService,
    RatingCleanupTask,
  ],
  exports: [RatingsService, RatingCalculatorService],
})
export class RatingsModule {}
