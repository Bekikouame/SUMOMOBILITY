import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Request, 
  HttpStatus, 
  Put, 
  UseGuards,
  UnauthorizedException 
} from '@nestjs/common';
import { ApiTags, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { CarpoolService } from './carpool.service';
import { CreateCarpoolReservationDto } from './dto/create-carpool-reservation.dto';
import { SearchCarpoolDto } from './dto/search-carpool.dto';
import { JoinCarpoolDto } from './dto/join-carpool.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Carpool')
@Controller('carpool')
export class CarpoolController {
  constructor(private readonly carpoolService: CarpoolService) {}

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

  @Post('search')
  @ApiResponse({ status: HttpStatus.OK, description: 'Covoiturages trouvés' })
  @ApiBody({ type: SearchCarpoolDto })
  async searchCarpool(@Body() searchDto: SearchCarpoolDto) {
    return this.carpoolService.searchCarpool(searchDto);
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
    
    const driverId = req.user.id;
    return this.carpoolService.getDriverPendingRequests(driverId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('driver/respond/:requestId')
  @ApiResponse({ status: 200, description: 'Réponse à une demande de covoiturage' })
  async respondToRequest(
    @Param('requestId') requestId: string,
    @Body() body: { action: 'accept' | 'reject', message?: string },
    @Request() req: any
  ) {
    if (!req.user) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }
    
    const driverId = req.user.id;
    return this.carpoolService.respondToRequest(requestId, body, driverId);
  }

  @Get('tracking/:reservationId')
  @ApiResponse({ status: 200, description: 'Suivi temps réel de la course' })
  async getReservationTracking(@Param('reservationId') reservationId: string) {
    return this.carpoolService.getReservationTracking(reservationId);
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
  // 🎯 NOUVEAUX ENDPOINTS - PRICING YANGO
  // ========================================

  /**
   * 💰 GET /carpool/:reservationId/my-price
   * Voir MON prix actuel (simple et rapide)
   * 🔒 Accessible par conducteur et passagers
   */
  @Get(':reservationId/my-price')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Prix actuel de l\'utilisateur' })
  async getMyCurrentPrice(
    @Param('reservationId') reservationId: string,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.carpoolService.getMyCurrentPrice(reservationId, userId);
  }

  /**
   * 📊 GET /carpool/:reservationId/pricing-summary
   * Voir le résumé COMPLET des prix
   * 🔒 Conducteur voit tout, passagers voient leur prix uniquement
   */
  @Get(':reservationId/pricing-summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Résumé détaillé des prix' })
  async getPricingSummary(
    @Param('reservationId') reservationId: string,
    @Request() req
  ) {
    const userId = req.user.id;
    return this.carpoolService.getCarpoolPricingSummary(reservationId, userId);
  }

  /**
   * 🔄 POST /carpool/:reservationId/recalculate-prices
   * Forcer le recalcul des prix (admin/debug)
   */
  @Post(':reservationId/recalculate-prices')
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