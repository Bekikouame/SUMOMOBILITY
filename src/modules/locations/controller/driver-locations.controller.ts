import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import {RolesGuard} from '../../../auth/guards/roles.guard';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { DriverLocationsService } from '../services/driver-locations.service';
import {  FindNearbyDriversDto } from '../dto/find-nearby-drivers.dto';
import {UpdateDriverLocationDto} from '../dto/update-driver-location.dto'
import { Roles } from 'src/auth/decorators/roles.decorator';

@ApiTags('Driver Locations')
@Controller('locations/drivers')
export class DriverLocationsController {
  constructor(private readonly driverLocationsService: DriverLocationsService) {}

  @Post('update-location')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mettre à jour la position (Chauffeur)' })
  updateLocation(
    @CurrentUser() user: any,
    @Body() dto: UpdateDriverLocationDto,
  ) {
    return this.driverLocationsService.updateLocation(user.driverProfile.id, dto);
  }

  @Get('nearby')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Chauffeurs à proximité' })
  findNearby(@Query() dto: FindNearbyDriversDto) {
    return this.driverLocationsService.findNearbyDrivers(dto);
  }

  @Get(':driverId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Position d\'un chauffeur' })
  getLocation(@Param('driverId') driverId: string) {
    return this.driverLocationsService.getDriverLocation(driverId);
  }

  @Post('go-offline')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('DRIVER')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Passer hors ligne (Chauffeur)' })
  goOffline(@CurrentUser() user: any) {
    return this.driverLocationsService.setDriverOffline(user.driverProfile.id);
  }
}
