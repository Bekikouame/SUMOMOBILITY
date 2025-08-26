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
import { RatingsService } from './ratings/ratings.service';
import { RatingsModule } from './ratings/ratings.module';



@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads/',
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ProfilesModule,
    VehiclesModule,
    DocumentsModule,
    RidesModule,
    ReservationsModule,
    RatingsModule,
    
  ],
  controllers: [AppController],
  providers: [AppService, RatingsService],
   
})
export class AppModule {}
