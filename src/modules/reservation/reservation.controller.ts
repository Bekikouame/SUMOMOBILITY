// src/reservations/reservations.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReservationsService } from '../reservation/reservation.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { ConvertReservationDto } from './dto/convert-reservation.dto';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, ReservationStatus } from '@prisma/client';

@ApiTags('reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @Roles(UserRole.CLIENT)
  @ApiOperation({ summary: 'Créer une nouvelle réservation' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Réservation créée avec succès' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Données invalides ou date dans le passé' 
  })
  async create(
    @Request() req,
    @Body() createReservationDto: CreateReservationDto
  ) {
    // Récupérer le profil client de l'utilisateur connecté
    const clientProfile = await this.reservationsService['prisma'].clientProfile.findUnique({
      where: { userId: req.user.sub }
    });
    
    if (!clientProfile) {
      throw new Error('Profil client introuvable. Complétez d\'abord votre profil.');
    }

    return this.reservationsService.create(clientProfile.id, createReservationDto);
  }

  @Get()
  @Roles(UserRole.CLIENT, UserRole.DRIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Lister les réservations' })
  @ApiQuery({ name: 'status', required: false, enum: ReservationStatus })
  @ApiQuery({ name: 'scheduledFrom', required: false, type: String })
  @ApiQuery({ name: 'scheduledTo', required: false, type: String })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Liste des réservations récupérée' 
  })
  async findAll(
    @Request() req,
    @Query('status') status?: ReservationStatus,
    @Query('scheduledFrom') scheduledFrom?: string,
    @Query('scheduledTo') scheduledTo?: string,
  ) {
    const filters = {
      status,
      scheduledFrom,
      scheduledTo,
    };

    return this.reservationsService.findAll(req.user.sub, req.user.role, filters);
  }

  @Get('stats')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Récupérer les statistiques des réservations' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Statistiques des réservations' 
  })
  async getStats(@Request() req) {
    return this.reservationsService.getStats(req.user.sub, req.user.role);
  }

  @Get('upcoming')
  @Roles(UserRole.ADMIN, UserRole.DRIVER)
  @ApiOperation({ summary: 'Récupérer les réservations à venir (pour notifications)' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: 'Nombre d\'heures à l\'avance (défaut: 24)' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Réservations à venir récupérées' 
  })
  async getUpcoming(@Query('hours') hours?: number) {
    return this.reservationsService.getUpcomingReservations(hours);
  }

  @Get(':id')
  @Roles(UserRole.CLIENT, UserRole.DRIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Récupérer une réservation par son ID' })
  @ApiParam({ name: 'id', description: 'ID de la réservation' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Réservation trouvée' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Réservation introuvable' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Accès non autorisé' 
  })
  async findOne(@Param('id') id: string, @Request() req) {
    return this.reservationsService.findOne(id, req.user.sub, req.user.role);
  }

  @Patch(':id')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier une réservation' })
  @ApiParam({ name: 'id', description: 'ID de la réservation' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Réservation modifiée avec succès' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Modification impossible (statut non compatible)' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Accès non autorisé' 
  })
  async update(
    @Param('id') id: string,
    @Request() req,
    @Body() updateReservationDto: UpdateReservationDto,
  ) {
    return this.reservationsService.update(id, req.user.sub, req.user.role, updateReservationDto);
  }

  @Patch(':id/confirm')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Confirmer une réservation' })
  @ApiParam({ name: 'id', description: 'ID de la réservation' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Réservation confirmée' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Confirmation impossible' 
  })
  async confirm(@Param('id') id: string, @Request() req) {
    return this.reservationsService.confirm(id, req.user.sub, req.user.role);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Annuler une réservation' })
  @ApiParam({ name: 'id', description: 'ID de la réservation' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Réservation annulée' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Annulation impossible' 
  })
  async cancel(
    @Param('id') id: string,
    @Request() req,
    @Body() cancelDto?: CancelReservationDto,
  ) {
    return this.reservationsService.cancel(
      id, 
      req.user.sub, 
      req.user.role, 
      cancelDto?.cancellationCauseId
    );
  }

  @Post(':id/convert')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Convertir une réservation en course réelle' })
  @ApiParam({ name: 'id', description: 'ID de la réservation' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Réservation convertie en course avec succès' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Conversion impossible (timing, statut, etc.)' 
  })
  async convertToRide(
    @Param('id') id: string,
    @Request() req,
    @Body() convertDto?: ConvertReservationDto,
  ) {
    return this.reservationsService.convertToRide(id, req.user.sub, req.user.role, convertDto);
  }

  @Delete(':id')
  @Roles(UserRole.CLIENT, UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer définitivement une réservation (ADMIN uniquement en général)' })
  @ApiParam({ name: 'id', description: 'ID de la réservation' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Réservation supprimée' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Suppression non autorisée' 
  })
  async remove(@Param('id') id: string, @Request() req) {
    // Pour la suppression définitive, on peut préférer l'annulation
    // Ici on délègue à l'annulation
    return this.reservationsService.cancel(id, req.user.sub, req.user.role);
  }
}