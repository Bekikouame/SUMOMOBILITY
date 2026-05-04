import {
  Controller,
  Post,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DriversService } from '../drivers/drivers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DriverActivityStatus } from '@prisma/client';

@ApiTags('Drivers - App')
@ApiBearerAuth()
@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
export class DriversAppController {
  constructor(private readonly driversService: DriversService) {}

  @Post('go-online')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Passer le chauffeur en ligne (disponible pour recevoir des courses)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Chauffeur passé en ligne avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle DRIVER requis' })
  async goOnline(@CurrentUser() driver: any) {
    return this.driversService.updateDriverActivityStatus(
      driver.id,
      DriverActivityStatus.ONLINE,
    );
  }

  @Post('go-offline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Passer le chauffeur hors ligne (indisponible)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Chauffeur passé hors ligne avec succès',
  })
  @ApiResponse({ status: 401, description: 'Non autorisé' })
  @ApiResponse({ status: 403, description: 'Accès refusé - Rôle DRIVER requis' })
  async goOffline(@CurrentUser() driver: any) {
    return this.driversService.updateDriverActivityStatus(
      driver.id,
      DriverActivityStatus.OFFLINE,
    );
  }

  @Get('status')
  @ApiOperation({ summary: 'Récupérer le statut actuel du chauffeur' })
  async getDriverStatus(@CurrentUser() driver: any) {
    return this.driversService.getDriverStatus(driver.id);
  }

  @Get('available-rides')
  @ApiOperation({ summary: 'Courses REQUESTED disponibles (polling fallback)' })
  async getAvailableRides(@CurrentUser() driver: any) {
    return this.driversService.getAvailableRides(driver.id);
  }
}