import { 
  Controller, 
  Post, 
  Get, 
  Patch,
  Body, 
  Param, 
  UseGuards, 
  Request, 
  BadRequestException,
  NotFoundException
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiProperty } from '@nestjs/swagger';
import { RideTrackingService, LocationUpdate } from './ride-tracking.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { IsNumber, IsOptional } from 'class-validator';

// DTO pour la mise à jour de position
export class UpdateLocationDto implements LocationUpdate {
  @ApiProperty({ example: 5.3364, description: 'Latitude GPS' })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -4.0267, description: 'Longitude GPS' })
  @IsNumber()
  longitude: number;

  @ApiProperty({ example: 180, description: 'Direction en degrés (0-360)', required: false })
  @IsOptional()
  @IsNumber()
  heading?: number;

  @ApiProperty({ example: 45.5, description: 'Vitesse en km/h', required: false })
  @IsOptional()
  @IsNumber()
  speed?: number;

  @ApiProperty({ example: 10, description: 'Précision GPS en mètres', required: false })
  @IsOptional()
  @IsNumber()
  accuracy?: number;
}

@ApiTags('Ride Tracking')
@Controller('rides/tracking')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RideTrackingController {
  constructor(private readonly trackingService: RideTrackingService) {}

  @Post('location')
  @ApiOperation({ 
    summary: 'Mettre à jour la position du chauffeur',
    description: 'Permet au chauffeur d\'envoyer sa position GPS en temps réel'
  })
  @ApiBody({ type: UpdateLocationDto })
  async updateLocation(@Request() req, @Body() locationDto: UpdateLocationDto) {
    // Récupérer l'ID du profil chauffeur
    const user = await this.getUserWithProfiles(req.user.id);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    if (!user.driverProfile) {
      throw new BadRequestException('Only drivers can update location');
    }

    return this.trackingService.updateDriverLocation(user.driverProfile.id, locationDto);
  }

  @Get(':rideId')
  @ApiOperation({ 
    summary: 'Suivre une course en temps réel',
    description: 'Récupère la position actuelle et l\'ETA pour une course'
  })
  async trackRide(@Request() req, @Param('rideId') rideId: string) {
    return this.trackingService.getRideTracking(rideId, req.user.id);
  }

  @Get(':rideId/history')
  @ApiOperation({ 
    summary: 'Historique du trajet',
    description: 'Récupère tous les points GPS enregistrés pour une course terminée'
  })
  async getRideHistory(@Request() req, @Param('rideId') rideId: string) {
    return this.trackingService.getRideTrackingHistory(rideId, req.user.id);
  }

  @Patch('offline')
  @ApiOperation({ 
    summary: 'Marquer le chauffeur comme hors ligne',
    description: 'Indique que le chauffeur n\'est plus disponible'
  })
  async goOffline(@Request() req) {
    const user = await this.getUserWithProfiles(req.user.id);
    
     if (!user) {
      throw new NotFoundException('User not found');
    }
    
    if (!user.driverProfile) {
      throw new BadRequestException('Only drivers can go offline');
    }

    return this.trackingService.markDriverOffline(user.driverProfile.id);
  }

  // Méthode utilitaire pour récupérer l'utilisateur avec ses profils
  private async getUserWithProfiles(userId: string) {
    // Cette méthode devrait être injectée via le PrismaService
    // ou vous pouvez l'appeler directement dans le service
    return this.trackingService['prisma'].user.findUnique({
      where: { id: userId },
      include: { 
        clientProfile: true, 
        driverProfile: true 
      }
    });
  }
}