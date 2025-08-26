// src/reservations/reservations.module.ts
import { Module } from '@nestjs/common';
import { ReservationsService } from '../reservation/reservation.service';
import { ReservationsController } from './reservation.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService], // Pour utiliser dans d'autres modules
})
export class ReservationsModule {}