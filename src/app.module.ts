import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
import { LocationsController } from './locations/locations.controller';
import { LocationsService } from './locations/locations.service';
import { LocationsModule } from './locations/locations.module';

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
    
  ],
  controllers: [AppController, LocationsController],
  providers: [AppService, LocationsService],
   
})
export class AppModule {}
