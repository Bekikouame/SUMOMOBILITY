// ===================================
// CONTROLLER - Routes API
// ===================================

// src/modules/rides/rides.controller.ts
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
  HttpStatus
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

  @Post()
  @ApiOperation({ summary: 'Demander une course (client)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Course créée avec succès' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Données invalides' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Seuls les clients peuvent demander des courses' })
  async createRide(@Req() req: any, @Body() createRideDto: CreateRideDto) {
    return this.ridesService.createRide(req.user.sub, createRideDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister mes courses' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Liste des courses' })
  async findMyRides(@Req() req: any, @Query() query: QueryRidesDto) {
    return this.ridesService.findUserRides(req.user.sub, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une course' })
  @ApiParam({ name: 'id', description: 'ID de la course' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Détails de la course' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Course non trouvée' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Accès refusé' })
  async findRide(@Req() req: any, @Param('id') id: string) {
    return this.ridesService.findRideById(req.user.sub, id);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accepter une course (chauffeur)' })
  @ApiParam({ name: 'id', description: 'ID de la course' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Course acceptée' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Course non disponible' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Seuls les chauffeurs approuvés peuvent accepter' })
  async acceptRide(@Req() req: any, @Param('id') id: string) {
    return this.ridesService.acceptRide(req.user.sub, id);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Démarrer une course (chauffeur)' })
  @ApiParam({ name: 'id', description: 'ID de la course' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Course démarrée' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Impossible de démarrer la course' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Seul le chauffeur assigné peut démarrer' })
  async startRide(@Req() req: any, @Param('id') id: string) {
    return this.ridesService.startRide(req.user.sub, id);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: 'Terminer une course (chauffeur)' })
  @ApiParam({ name: 'id', description: 'ID de la course' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Course terminée' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Impossible de terminer la course' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Seul le chauffeur assigné peut terminer' })
  async completeRide(@Req() req: any, @Param('id') id: string) {
    return this.ridesService.completeRide(req.user.sub, id);
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
    return this.ridesService.cancelRide(req.user.sub, id, cancelDto);
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
    return this.ridesService.rateRide(req.user.sub, id, ratingDto);
  }
}
