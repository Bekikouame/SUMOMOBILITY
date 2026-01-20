// src/modules/wallet/wallet.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { AddPaymentMethodDto } from './dto/add-payment-method.dto';
import { RequestWithdrawalDto } from './dto/request-withdrawal.dto';
import { GetTransactionsDto } from './dto/get-transactions.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('wallet')
@ApiBearerAuth()
@Controller('wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DRIVER')
export class WalletController {
  constructor(
    private readonly walletService: WalletService,
    private readonly prisma: PrismaService,
  ) {}

  // Méthode utilitaire pour récupérer le driverProfileId
  private async getDriverProfileId(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { driverProfile: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (!user.driverProfile) {
      throw new BadRequestException('Seuls les chauffeurs ont accès au portefeuille');
    }

    return user.driverProfile.id;
  }

  // Obtenir le solde du portefeuille
  @Get('balance')
  @ApiOperation({ summary: 'Obtenir le solde du portefeuille' })
  async getBalance(@CurrentUser() user: any) {
    const driverId = await this.getDriverProfileId(user.id);
    return this.walletService.getBalance(driverId);
  }

  // Obtenir les transactions
  @Get('transactions')
  @ApiOperation({ summary: 'Obtenir l\'historique des transactions' })
  async getTransactions(@CurrentUser() user: any, @Query() filters: GetTransactionsDto) {
    const driverId = await this.getDriverProfileId(user.id);
    return this.walletService.getTransactions(driverId, filters);
  }

  // Obtenir les statistiques de gains
  @Get('earnings/:period')
  @ApiOperation({ summary: 'Obtenir les statistiques de gains par période' })
  async getEarningsStats(
    @CurrentUser() user: any,
    @Param('period') period: 'today' | 'week' | 'month',
  ) {
    const driverId = await this.getDriverProfileId(user.id);
    return this.walletService.getEarningsStats(driverId, period);
  }

  // Obtenir les méthodes de paiement
  @Get('payment-methods')
  @ApiOperation({ summary: 'Obtenir les méthodes de paiement enregistrées' })
  async getPaymentMethods(@CurrentUser() user: any) {
    const driverId = await this.getDriverProfileId(user.id);
    return this.walletService.getPaymentMethods(driverId);
  }

  // Ajouter une méthode de paiement
  @Post('payment-methods')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Ajouter une nouvelle méthode de paiement' })
  async addPaymentMethod(@CurrentUser() user: any, @Body() dto: AddPaymentMethodDto) {
    const driverId = await this.getDriverProfileId(user.id);
    return this.walletService.addPaymentMethod(driverId, dto);
  }

  // Supprimer une méthode de paiement
  @Delete('payment-methods/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer une méthode de paiement' })
  async removePaymentMethod(@CurrentUser() user: any, @Param('id') methodId: string) {
    const driverId = await this.getDriverProfileId(user.id);
    return this.walletService.removePaymentMethod(driverId, methodId);
  }

  // Définir une méthode comme par défaut
  @Post('payment-methods/:id/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Définir une méthode de paiement par défaut' })
  async setDefaultPaymentMethod(@CurrentUser() user: any, @Param('id') methodId: string) {
    const driverId = await this.getDriverProfileId(user.id);
    return this.walletService.setDefaultPaymentMethod(driverId, methodId);
  }

  // Demander un retrait
  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Demander un retrait d\'argent' })
  async requestWithdrawal(@CurrentUser() user: any, @Body() dto: RequestWithdrawalDto) {
    const driverId = await this.getDriverProfileId(user.id);
    return this.walletService.requestWithdrawal(driverId, dto);
  }

  // Recharger le wallet
  @Post('recharge')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Recharger le wallet via Wave/Orange Money' })
  async rechargeWallet(
    @CurrentUser() user: any,
    @Body() body: { amount: number; paymentMethodId: string; note?: string },
  ) {
    const driverId = await this.getDriverProfileId(user.id);
    return this.walletService.rechargeWallet(
      driverId,
      body.amount,
      body.paymentMethodId,
      body.note,
    );
  }

  // Vérifier si le chauffeur peut accepter une course
  @Get('can-accept-ride/:amount')
  @ApiOperation({ summary: 'Vérifier si le chauffeur a assez de solde pour accepter une course' })
  async canAcceptRide(@CurrentUser() user: any, @Param('amount') amount: string) {
    const driverId = await this.getDriverProfileId(user.id);
    const canAccept = await this.walletService.canAcceptRide(driverId, parseFloat(amount));
    return { canAccept, amount: parseFloat(amount) };
  }
}
