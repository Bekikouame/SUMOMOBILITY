import { Module } from '@nestjs/common';
import { RideTrackingService } from './ride-tracking.service';
import { RideTrackingController } from './ride-tracking.controller';
import { PrismaModule } from '../../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RideTrackingController],
  providers: [RideTrackingService],
  exports: [RideTrackingService]
})
export class RideTrackingModule {}