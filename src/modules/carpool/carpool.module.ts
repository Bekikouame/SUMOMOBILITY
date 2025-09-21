import { Module } from '@nestjs/common';
import { CarpoolController } from './carpool.controller';
import { CarpoolService } from './carpool.service';
import { CarpoolPricingService } from './services/carpool-pricing.service';
import { RouteCalculationService } from './services/route-calculation.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CarpoolController],
  providers: [
    CarpoolService,
    CarpoolPricingService,
    RouteCalculationService,
  ],
  exports: [CarpoolService],
})
export class CarpoolModule {}