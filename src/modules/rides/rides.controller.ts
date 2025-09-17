// src/modules/rides/rides.controller.ts - Version corrigée
import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Query,
  UseGuards,
  Req,
  HttpStatus,
  BadRequestException
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RidesService } from './rides.service';
import { CreateRideDto } from './dto/create-ride.dto';
import { CancelRideDto } from './dto/cancel-ride.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { QueryRidesDto } from './dto/query-rides.dto';

@ApiTags('Rides')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rides')
export class RidesController {
  constructor(private readonly ridesService: RidesService) {}

  // Méthode utilitaire pour extraire l'userId de manière robuste
  private extractUserId(req: any): string {
    console.log('=== DEBUG EXTRACTION USERID ===');
    console.log('req.user:', JSON.stringify(req.user, null, 2));
    console.log('req.user keys:', Object.keys(req.user || {}));
    
    // Essayer différentes propriétés possibles
    const userId = req.user?.sub || 
                  req.user?.id || 
                  req.user?.userId || 
                  req.user?.user_id ||
                  req.user?._id;

    console.log('userId extrait:', userId);
    console.log('type userId:', typeof userId);

    if (!userId) {
      throw new BadRequestException(
        `Impossible d'extraire l'ID utilisateur du token JWT. ` +
        `Propriétés disponibles dans req.user: ${Object.keys(req.user || {}).join(', ')}`
      );
    }

    return userId;
  }

  @Post()
  @ApiOperation({ summary: 'Demander une course (client)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Course créée avec succès' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Données invalides' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Seuls les clients peuvent demander des courses' })
  async createRide(@Req() req: any, @Body() createRideDto: CreateRideDto) {
    const userId = this.extractUserId(req);
    return this.ridesService.createRide(userId, createRideDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister mes courses' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Liste des courses' })
  async findMyRides(@Req() req: any, @Query() query: QueryRidesDto) {
    const userId = this.extractUserId(req);
    return this.ridesService.findUserRides(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une course' })
  @ApiParam({ name: 'id', description: 'ID de la course' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Détails de la course' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Course non trouvée' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Accès refusé' })
  async findRide(@Req() req: any, @Param('id') id: string) {
    const userId = this.extractUserId(req);
    return this.ridesService.findRideById(userId, id);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accepter une course (chauffeur)' })
  @ApiParam({ name: 'id', description: 'ID de la course' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Course acceptée' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Course non disponible' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Seuls les chauffeurs approuvés peuvent accepter' })
  async acceptRide(@Req() req: any, @Param('id') id: string) {
    const userId = this.extractUserId(req);
    return this.ridesService.acceptRide(userId, id);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Démarrer une course (chauffeur)' })
  @ApiParam({ name: 'id', description: 'ID de la course' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Course démarrée' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Impossible de démarrer la course' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Seul le chauffeur assigné peut démarrer' })
  async startRide(@Req() req: any, @Param('id') id: string) {
    const userId = this.extractUserId(req);
    return this.ridesService.startRide(userId, id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Terminer une course (chauffeur)' })
  @ApiParam({ name: 'id', description: 'ID de la course' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Course terminée' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Impossible de terminer la course' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Seul le chauffeur assigné peut terminer' })
  async completeRide(@Req() req: any, @Param('id') id: string) {
    const userId = this.extractUserId(req);
    return this.ridesService.completeRide(userId, id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Annuler une course' })
  @ApiParam({ name: 'id', description: 'ID de la course' })
  @ApiBody({ type: CancelRideDto })
  @ApiResponse({ status: HttpStatus.OK, description: 'Course annulée' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Impossible d\'annuler la course' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Pas d\'autorisation pour annuler' })
  async cancelRide(
    @Req() req: any, 
    @Param('id') id: string, 
    @Body() cancelDto: CancelRideDto
  ) {
    const userId = this.extractUserId(req);
    return this.ridesService.cancelRide(userId, id, cancelDto);
  }

  @Post(':id/rating')
  @ApiOperation({ summary: 'Noter une course (client)' })
  @ApiParam({ name: 'id', description: 'ID de la course' })
  @ApiBody({ type: CreateRatingDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Note enregistrée' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Course déjà notée ou non terminée' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Seuls les clients peuvent noter' })
  async rateRide(
    @Req() req: any, 
    @Param('id') id: string, 
    @Body() ratingDto: CreateRatingDto
  ) {
    const userId = this.extractUserId(req);
    return this.ridesService.rateRide(userId, id, ratingDto);
  }
}