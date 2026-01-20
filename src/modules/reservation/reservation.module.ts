// src/reservations/reservations.module.ts
import { Module } from '@nestjs/common';
import { ReservationsService } from '../reservation/reservation.service';
import { ReservationsController } from './reservation.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PushNotificationsModule } from '../push-notifications/push-notifications.module';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, PushNotificationsModule, WalletModule, NotificationsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService], // Pour utiliser dans d'autres modules
})
export class ReservationsModule {}