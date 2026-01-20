// src/modules/drivers/drivers.controller.ts

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Drivers - Admin')
@ApiBearerAuth()
@Controller('admin/drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class DriversController {
  constructor(private driversService: DriversService) {}

  @Get('pending')
  @ApiOperation({ summary: 'Récupérer tous les chauffeurs en attente d\'approbation' })
  async getPendingDrivers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.driversService.getPendingDrivers(
      parseInt(page),
      parseInt(limit),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Récupérer tous les chauffeurs avec filtres' })
  async getAllDrivers(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
    // @Query('status', { required: false }) status?: string,
    // @Query('search', { required: false }) search?: string,
  ) {
    return this.driversService.getAllDrivers({
      page: parseInt(page),
      limit: parseInt(limit),
      // status,
      // search,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Récupérer les détails d\'un chauffeur' })
  async getDriverDetails(@Param('id') id: string) {
    return this.driversService.getDriverDetails(id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approuver un chauffeur' })
  @ApiResponse({ status: 200, description: 'Chauffeur approuvé avec succès' })
  async approveDriver(
    @Param('id') driverId: string,
    @CurrentUser() admin: any,
    @Body() body: { message?: string },
  ) {
    console.log(' Requête d\'approbation reçue pour le chauffeur:', driverId);
    console.log('Admin:', admin.id);
    console.log(' Message:', body.message);

    return this.driversService.approveDriver(
      driverId,
      admin.id,
      body.message,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rejeter un chauffeur' })
  @ApiResponse({ status: 200, description: 'Chauffeur rejeté' })
  async rejectDriver(
    @Param('id') driverId: string,
    @CurrentUser() admin: any,
    @Body() body: { reason?: string },
  ) {
    console.log(' Requête de rejet reçue pour le chauffeur:', driverId);
    console.log(' Admin:', admin.id);
    console.log('Raison:', body.reason);

    return this.driversService.rejectDriver(
      driverId,
      admin.id,
      body.reason,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Supprimer un chauffeur' })
  async deleteDriver(
    @Param('id') driverId: string,
    @CurrentUser() admin: any,
  ) {
    return this.driversService.deleteDriver(driverId, admin.id);
  }




}