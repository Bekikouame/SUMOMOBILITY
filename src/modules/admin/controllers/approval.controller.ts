// src/modules/admin/controllers/approval.controller.ts

import { 
  Controller, 
  Post, 
  Put, 
  Param,
  Body, 
  UseGuards,
  HttpCode,
  HttpStatus 
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth 
} from '@nestjs/swagger';
import { AutoApprovalService } from '../services/auto-approval.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Admin - Approbations')
@Controller('admin/approvals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ApprovalController {
  constructor(
    private autoApprovalService: AutoApprovalService
  ) {} // ✅ CORRECTION ICI - enlever les autres injections

  // ===============================
  // AUTO-APPROUVER TOUT
  // ===============================
  @Post('auto-approve-all')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Auto-approuver tous les éléments en attente',
    description: 'Approuve automatiquement tous les chauffeurs, documents et véhicules en attente'
  })
  @ApiResponse({ status: 200, description: 'Approbations effectuées avec succès' })
  async autoApproveAll() {
    return await this.autoApprovalService.autoApproveAll();
  }

  // ===============================
  // ✅ NOUVEAU : APPROUVER UN CHAUFFEUR + EMAIL
  // ===============================
  @Put('drivers/:driverId/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Approuver un chauffeur',
    description: 'Approuve le chauffeur, vérifie son véhicule et envoie un email' 
  })
  @ApiResponse({ status: 200, description: 'Chauffeur approuvé et email envoyé' })
  async approveDriver(@Param('driverId') driverId: string) {
    const result = await this.autoApprovalService.approveDriverWithEmail(driverId);
    return {
      success: true,
      message: 'Chauffeur approuvé avec succès. Email envoyé.',
      driver: result.driver,
      emailSent: result.emailSent
    };
  }

  // ===============================
  // ✅ NOUVEAU : REJETER UN CHAUFFEUR + EMAIL
  // ===============================
  @Put('drivers/:driverId/reject')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Rejeter un chauffeur',
    description: 'Rejette le chauffeur et envoie un email avec la raison' 
  })
  @ApiResponse({ status: 200, description: 'Chauffeur rejeté et email envoyé' })
  async rejectDriver(
    @Param('driverId') driverId: string,
    @Body() body: { reason?: string }
  ) {
    const result = await this.autoApprovalService.rejectDriverWithEmail(
      driverId, 
      body.reason
    );
    return {
      success: true,
      message: 'Chauffeur rejeté',
      driver: result.driver,
      emailSent: result.emailSent
    };
  }

  // ===============================
  // VÉRIFIER UN VÉHICULE
  // ===============================
  @Put('vehicles/:vehicleId/verify')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Vérifier un véhicule' })
  @ApiResponse({ status: 200, description: 'Véhicule vérifié' })
  async verifyVehicle(@Param('vehicleId') vehicleId: string) {
    const vehicle = await this.autoApprovalService.verifyVehicle(vehicleId);
    return {
      success: true,
      message: 'Véhicule vérifié avec succès',
      vehicle
    };
  }
}