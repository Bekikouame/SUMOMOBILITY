import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service'; // ✅ Import présent
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { VehiclesModule } from './modules/vehicules/vehicules.module';
import { DocumentsModule } from './documents/documents.module';
import { ServeStaticModule } from '@nestjs/serve-static'; 
import { join } from 'path'; 
import { ConfigModule } from '@nestjs/config';
import { RidesModule } from './modules/rides/rides.module';
import { ReservationsModule } from './modules/reservation/reservation.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { LocationsModule } from './modules/locations/locations.module';
import { AdminModule } from './modules/admin/admin.module';
import { RideTrackingModule } from './modules/rides/tracking/ride-tracking.module';
import { CarpoolController } from './modules/carpool/carpool.controller';
import { CarpoolModule } from './modules/carpool/carpool.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { PushNotificationsModule } from './modules/push-notifications/push-notifications.module';
import { FirebaseModule } from './modules/firebase/firebase.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { RatingsModule } from './modules/ratings/ratings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads/',
    }),
    EventEmitterModule.forRoot(),

    PrismaModule,
    UsersModule,
    AuthModule,
    ProfilesModule,
    VehiclesModule,
    DocumentsModule,
    RidesModule,
    ReservationsModule,
    PaymentsModule,
    NotificationsModule,
    LocationsModule,
    AdminModule,
    RideTrackingModule,
    CarpoolModule,
    DriversModule,
    FirebaseModule,
    PushNotificationsModule,
    WalletModule,
    RatingsModule,
  ],
  controllers: [
    CarpoolController, 
    AppController
  ],
  providers: [AppService], 
})
export class AppModule {}