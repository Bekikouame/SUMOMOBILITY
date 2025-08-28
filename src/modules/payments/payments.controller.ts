// src/payments/payments.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiBearerAuth, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiQuery 
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole, PaymentMethod, PaymentStatus } from '@prisma/client'; // ✅ Import PaymentMethod et PaymentStatus
import { PrismaService } from '../../prisma/prisma.service';

// DTOs corrigés
export class CreatePaymentDto {
  amount: number;
  method: PaymentMethod; // ✅ Utiliser PaymentMethod au lieu de string
  rideId?: string;
  reservationId?: string;
  metadata?: Record<string, any>;
}

export class PaymentFilterDto {
  status?: PaymentStatus; // ✅ Utiliser PaymentStatus au lieu de string
  method?: PaymentMethod; // ✅ Utiliser PaymentMethod au lieu de string
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export class RefundPaymentDto {
  amount?: number;
  reason: string;
}

@ApiTags('Paiements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Créer un nouveau paiement' })
  @ApiResponse({ status: 201, description: 'Paiement créé avec succès' })
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentsService.createPayment(createPaymentDto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Liste tous les paiements (Admin)' })
  @ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut' })
  @ApiQuery({ name: 'method', required: false, description: 'Filtrer par méthode' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Date de début (ISO)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Date de fin (ISO)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Nombre de résultats' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: 'Décalage pour pagination' })
  async findAll(@Query() filters: PaymentFilterDto) {
    return this.paymentsService.findAll(filters);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques des paiements (Admin)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Date de début (ISO)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Date de fin (ISO)' })
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.paymentsService.getPaymentStats(startDate, endDate);
  }

  @Get('driver/:driverId')
  @ApiOperation({ summary: 'Gains d\'un chauffeur' })
  @ApiParam({ name: 'driverId', description: 'ID du profil chauffeur' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Date de début (ISO)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Date de fin (ISO)' })
  async getDriverEarnings(
    @Param('driverId') driverId: string,
    @Request() req: any, // ✅ Déplacer req avant les paramètres optionnels
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    // Vérifier que l'utilisateur peut consulter ces gains
    if (req.user.role !== UserRole.ADMIN) {
      // Un chauffeur ne peut voir que ses propres gains
      const userDriverProfile = await this.prisma.driverProfile.findUnique({
        where: { userId: req.user.sub },
      });
      
      if (!userDriverProfile || userDriverProfile.id !== driverId) {
        throw new ForbiddenException('Vous ne pouvez consulter que vos propres gains');
      }
    }

    return this.paymentsService.getDriverEarnings(driverId, startDate, endDate);
  }

  @Get('ride/:rideId')
  @ApiOperation({ summary: 'Paiements d\'une course spécifique' })
  @ApiParam({ name: 'rideId', description: 'ID de la course' })
  async findRidePayments(@Param('rideId') rideId: string) {
    return this.paymentsService.findRidePayments(rideId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un paiement' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  async findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Patch(':id/process')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Traiter un paiement (Admin)' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Paiement traité avec succès' })
  async processPayment(@Param('id') id: string) {
    return this.paymentsService.processPayment(id);
  }

  @Post(':id/refund')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Rembourser un paiement (Admin)' })
  @ApiParam({ name: 'id', description: 'ID du paiement' })
  @ApiResponse({ status: 200, description: 'Remboursement effectué avec succès' })
  async refundPayment(
    @Param('id') id: string,
    @Body() refundDto: RefundPaymentDto,
    @Request() req: any, // ✅ req est maintenant en dernier (paramètre requis)
  ) {
    return this.paymentsService.refundPayment(id, refundDto, req.user.sub);
  }
}