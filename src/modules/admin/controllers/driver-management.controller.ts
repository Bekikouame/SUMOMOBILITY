// src/modules/admin/controllers/driver-management.controller.ts

import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
  
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBadRequestResponse,ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DriverManagementService } from '../services/driver-management.service';
import { ApproveDriverDto, RejectDriverDto } from '../dto/driver-management.dto';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';

@ApiTags('Admin - Gestion Chauffeurs')
@ApiBearerAuth()
@Controller('admin/drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class DriverManagementController {
  constructor(private driverService: DriverManagementService) {}

  @Get()
  @ApiOperation({ summary: 'Liste de tous les chauffeurs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getAllDrivers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    // ✅ CORRECTION : Parser et valider les paramètres
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    
    return this.driverService.getAllDrivers(
      pageNumber,
      limitNumber,
      status, // Peut être undefined
      search, // Peut être undefined
    );
  }

  @Get('pending')
  @ApiOperation({ summary: 'Chauffeurs en attente d\'approbation' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getPendingDrivers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // ✅ CORRECTION : Parser avec valeurs par défaut
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    
    return this.driverService.getPendingDrivers(pageNumber, limitNumber);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Statistiques des chauffeurs' })
  async getDriverStatistics() {
    return this.driverService.getStatistics();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détails complets d\'un chauffeur' })
  async getDriverDetails(@Param('id') id: string) {
    return this.driverService.getDriverDetails(id);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: 'Documents d\'un chauffeur avec aperçu' })
  async getDriverDocuments(@Param('id') id: string) {
    return this.driverService.getDriverDocuments(id);
  }

  @Get(':id/vehicle')
  @ApiOperation({ summary: 'Véhicule d\'un chauffeur' })
  async getDriverVehicle(@Param('id') id: string) {
    return this.driverService.getDriverVehicle(id);
  }

  @Put(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuver un chauffeur' })
  async approveDriver(
    @Param('id') id: string,
    @Body() dto: ApproveDriverDto,
  ) {
    return this.driverService.approveDriver(id, dto);
  }

  @Put(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeter un chauffeur' })
  async rejectDriver(
    @Param('id') id: string,
    @Body() dto: RejectDriverDto,
  ) {
    return this.driverService.rejectDriver(id, dto);
  }

  @Put(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspendre un chauffeur' })
  async suspendDriver(@Param('id') id: string) {
    return this.driverService.suspendDriver(id);
  }

  @Put(':id/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Réactiver un chauffeur' })
  async activateDriver(@Param('id') id: string) {
    return this.driverService.activateDriver(id);
  }



@Delete(':id')
@HttpCode(HttpStatus.OK)
@ApiOperation({ 
  summary: 'Supprimer définitivement un chauffeur',
  description: 'Supprime le chauffeur, ses documents, véhicules et toutes ses données. Action irréversible.'
})
@ApiResponse({ 
  status: 200, 
  description: 'Chauffeur supprimé avec succès',
  schema: {
    example: {
      success: true,
      message: 'Chauffeur John Doe supprimé avec succès'
    }
  }
})
@ApiBadRequestResponse({ 
  description: 'Le chauffeur a des courses en cours',
  schema: {
    example: {
      success: false,
      message: 'Impossible de supprimer un chauffeur avec des courses en cours'
    }
  }
})
async deleteDriver(
  @Param('id') id: string,
  @CurrentUser() admin: any,
) {
  return this.driverService.deleteDriver(id, admin.id);
}
}