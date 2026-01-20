import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Request,
  HttpStatus,
  UseGuards,
  UnauthorizedException,
  Req,
  NotFoundException
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CarpoolService } from './carpool.service';
import { CreateCarpoolReservationDto } from './dto/create-carpool-reservation.dto';
import { SearchCarpoolDto } from './dto/search-carpool.dto';
import { JoinCarpoolDto } from './dto/join-carpool.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Carpool')
@Controller('carpool')
export class CarpoolController {
  constructor(
    private readonly carpoolService: CarpoolService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('create')
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Réservation covoiturage créée' })
  @ApiBody({ type: CreateCarpoolReservationDto })
  async createCarpoolReservation(
    @Body() createDto: CreateCarpoolReservationDto,
    @Request() req: any
  ) {
    console.log('=== DEBUG CONTRÔLEUR ===');
    console.log('Request user object:', req.user);
    console.log('Request headers:', req.headers.authorization);
    
    if (!req.user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    
    const clientId = req.user.id;
    return this.carpoolService.createCarpoolReservation(createDto, clientId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('search')
  @ApiResponse({ status: HttpStatus.OK, description: 'Covoiturages trouvés' })
  @ApiBody({ type: SearchCarpoolDto })
  async searchCarpool(@Body() searchDto: SearchCarpoolDto, @Request() req: any) {
    if (!req.user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const userId = req.user.id;
    return this.carpoolService.searchCarpool(searchDto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('join')
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Demande de covoiturage envoyée' })
  @ApiBody({ type: JoinCarpoolDto })
  async joinCarpool(
    @Body() joinDto: JoinCarpoolDto,
    @Request() req: any
  ) {
    if (!req.user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    
    const userId = req.user.id;
    return this.carpoolService.joinCarpool(joinDto, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('requests/:userId')
  @ApiResponse({ status: HttpStatus.OK, description: 'Demandes de covoiturage de l\'utilisateur' })
  async getUserCarpoolRequests(
    @Param('userId') userId: string,
    @Request() req: any
  ) {
    if (req.user.id !== userId) {
      throw new UnauthorizedException('Accès non autorisé');
    }
    
    return this.carpoolService.getUserCarpoolRequests(userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('driver/pending-requests')
  @ApiResponse({ status: 200, description: 'Demandes en attente pour le chauffeur' })
  async getDriverPendingRequests(@Request() req: any) {
    if (!req.user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    // Récupérer le driverProfileId à partir du userId
    const userId = req.user.id;
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    return this.carpoolService.getDriverPendingRequests(driver.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('driver/active-carpools')
  @ApiResponse({ status: 200, description: 'Covoiturages actifs du chauffeur' })
  async getDriverActiveCarpools(@Request() req: any) {
    if (!req.user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    // Récupérer le driverProfileId à partir du userId
    const userId = req.user.id;
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException('Profil chauffeur non trouvé');
    }

    return this.carpoolService.getDriverActiveCarpools(driver.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':reservationId/passenger-rides')
  @ApiResponse({ status: 200, description: 'Rides des passagers du covoiturage' })
  async getCarpoolPassengerRides(@Param('reservationId') reservationId: string) {
    return this.carpoolService.getCarpoolPassengerRides(reservationId);
  }

  /**
   * POST /carpool/respond/:requestId
   * Répondre à une demande de covoiturage (accepter/refuser)
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('respond/:requestId')
  @ApiResponse({ status: 200, description: 'Réponse à une demande de covoiturage' })
  async respondToRequest(
    @Param('requestId') requestId: string,
    @Body() body: { accept?: boolean; action?: 'accept' | 'reject'; message?: string },
    @Request() req: any
  ) {
    if (!req.user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    const userId = req.user.id;

    // Support both formats: {accept: true/false} and {action: 'accept'/'reject'}
    const normalizedBody = {
      action: body.action || (body.accept ? 'accept' : 'reject') as 'accept' | 'reject',
      message: body.message
    };

    return this.carpoolService.respondToRequest(requestId, normalizedBody, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('test-auth')
  @ApiResponse({ status: 200, description: 'Test d\'authentification' })
  testAuth(@Request() req: any) {
    return {
      message: 'Authentification réussie',
      user: {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      }
    };
  }

  // ========================================
  // 🎯 ENDPOINTS COVOITURAGE
  // ========================================

  /**
   * GET /carpool/my-requests
   * Récupérer toutes mes demandes de covoiturage
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('my-requests')
  @ApiResponse({ status: 200, description: 'Mes demandes de covoiturage' })
  async getUserRequests(@Req() req: any) {
    return this.carpoolService.getUserCarpoolRequests(req.user.id);
  }

  /**
   * GET /carpool/tracking/:reservationId
   * Suivi temps réel du covoiturage
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('tracking/:reservationId')
  @ApiResponse({ status: 200, description: 'Suivi temps réel de la course' })
  async getTracking(@Param('reservationId') reservationId: string) {
    return this.carpoolService.getReservationTracking(reservationId);
  }

  /**
   * GET /carpool/pricing/:reservationId
   * Résumé complet des prix du covoiturage
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('pricing/:reservationId')
  @ApiResponse({ status: 200, description: 'Résumé détaillé des prix' })
  async getPricing(
    @Param('reservationId') reservationId: string,
    @Req() req: any
  ) {
    return this.carpoolService.getCarpoolPricingSummary(reservationId, req.user.id);
  }

  /**
   * GET /carpool/my-price/:reservationId
   * Mon prix actuel pour ce covoiturage
   */
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('my-price/:reservationId')
  @ApiResponse({ status: 200, description: 'Prix actuel de l\'utilisateur' })
  async getMyPrice(
    @Param('reservationId') reservationId: string,
    @Req() req: any
  ) {
    return this.carpoolService.getMyCurrentPrice(reservationId, req.user.id);
  }

  /**
   * 🔄 POST /carpool/recalculate-prices/:reservationId
   * Forcer le recalcul des prix (admin/debug)
   */
  @Post('recalculate-prices/:reservationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Prix recalculés' })
  async recalculatePrices(
    @Param('reservationId') reservationId: string
  ) {
    await this.carpoolService.recalculateCarpoolPricesYango(reservationId);
    return {
      success: true,
      message: 'Prix recalculés avec succès selon le modèle Yango'
    };
  }


}