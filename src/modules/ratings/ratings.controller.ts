// src/ratings/ratings.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { RatingFilterDto } from './dto/rating-filter.dto';
import { ModerateRatingDto } from './dto/moderate-rating.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';

@ApiTags('Évaluations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ratings')
export class RatingsController {
  constructor(
    private readonly ratingsService: RatingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Créer une évaluation' })
  @ApiResponse({ status: 201, description: 'Évaluation créée avec succès' })
  async createRating(
    @Body() createRatingDto: CreateRatingDto,
    @Request() req: any,
  ) {
    return this.ratingsService.createRating(createRatingDto, req.user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Liste toutes les évaluations (Admin)' })
  async findAll(@Query() filters: RatingFilterDto) {
    return this.ratingsService.findAll(filters);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques globales des évaluations (Admin)' })
  async getGlobalStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.ratingsService.getGlobalStats(startDate, endDate);
  }

  @Get('moderation/pending')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Évaluations en attente de modération (Admin)' })
  async getPendingModerations() {
    return this.ratingsService.getPendingModerations();
  }

  @Get('ride/:rideId')
  @ApiOperation({ summary: 'Évaluations d\'une course' })
  @ApiParam({ name: 'rideId', description: 'ID de la course' })
  async getRideRatings(@Param('rideId') rideId: string) {
    return this.ratingsService.getRideRatings(rideId);
  }

  @Get('driver/:driverId')
  @ApiOperation({ summary: 'Statistiques d\'un chauffeur' })
  @ApiParam({ name: 'driverId', description: 'ID du profil chauffeur' })
  async getDriverStats(@Param('driverId') driverId: string) {
    return this.ratingsService.getDriverStats(driverId);
  }

  @Get('client/:clientId')
  @ApiOperation({ summary: 'Historique des évaluations d\'un client' })
  @ApiParam({ name: 'clientId', description: 'ID du profil client' })
  async getClientRatingHistory(
    @Param('clientId') clientId: string,
    @Query() filters: RatingFilterDto,
    @Request() req: any,
  ) {
    // Vérifier que l'utilisateur peut accéder à cet historique
    if (req.user.role !== UserRole.ADMIN) {
      const userClientProfile = await this.prisma.clientProfile.findUnique({
        where: { userId: req.user.sub },
      });
      
      if (!userClientProfile || userClientProfile.id !== clientId) {
        throw new ForbiddenException('Vous ne pouvez consulter que votre propre historique');
      }
    }

    return this.ratingsService.getClientRatingHistory(clientId, filters);
  }

  @Patch(':id/moderate')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modérer une évaluation (Admin)' })
  @ApiParam({ name: 'id', description: 'ID de l\'évaluation' })
  async moderateRating(
    @Param('id') id: string,
    @Body() moderateDto: ModerateRatingDto,
    @Request() req: any,
  ) {
    return this.ratingsService.moderateRating(id, moderateDto, req.user.sub);
  }
}