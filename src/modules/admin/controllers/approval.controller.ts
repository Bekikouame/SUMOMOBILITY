// src/modules/admin/controllers/approval.controller.ts
import { 
  Controller, 
  Post, 
  Put, 
  Param, 
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
  constructor(private autoApprovalService: AutoApprovalService) {}

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
  // APPROUVER UN CHAUFFEUR ET SES ÉLÉMENTS
  // ===============================
  @Put('drivers/:driverId/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ 
    summary: 'Approuver un chauffeur',
    description: 'Approuve le chauffeur et tous ses documents/véhicules' 
  })
  @ApiResponse({ status: 200, description: 'Chauffeur approuvé' })
  async approveDriver(@Param('driverId') driverId: string) {
    const driver = await this.autoApprovalService.approveDriver(driverId);
    return {
      success: true,
      message: 'Chauffeur approuvé avec succès',
      driver
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