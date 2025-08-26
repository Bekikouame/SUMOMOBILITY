// ===================================
// MODULE - Configuration NestJS
// ===================================

// src/modules/rides/rides.module.ts
import { Module } from '@nestjs/common';
import { RidesController } from './rides.controller';
import { RidesService } from './rides.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RidesController],
  providers: [RidesService],
  exports: [RidesService],
})
export class RidesModule {}
