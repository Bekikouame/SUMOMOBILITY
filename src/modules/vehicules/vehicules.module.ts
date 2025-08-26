// src/vehicles/vehicles.module.ts
import { Module } from '@nestjs/common';
import { VehiclesService } from './vehicules.service';
import { VehiclesController } from './vehicules.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService]
})
export class VehiclesModule {}