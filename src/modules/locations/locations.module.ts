import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { GeolocationService } from './services/geolocation.service';
import { ServiceZonesService } from './services/service-zones.service';
import { PointsOfInterestService } from './services/points-of-interest.service';
import { DriverLocationsService } from './services/driver-locations.service';

import { ServiceZonesController } from './controller/service-zones.controller';
import { PointsOfInterestController } from './controller/points-of-interest.controller';
import { DriverLocationsController } from './controller/driver-locations.controller';

@Module({
  imports: [PrismaModule],
  providers: [
    GeolocationService,
    ServiceZonesService,
    PointsOfInterestService,
    DriverLocationsService,
  ],
  controllers: [
    ServiceZonesController,
    PointsOfInterestController,
    DriverLocationsController,
  ],
  exports: [
    GeolocationService,
    ServiceZonesService,
    PointsOfInterestService,
    DriverLocationsService,
  ],
})
export class LocationsModule {}