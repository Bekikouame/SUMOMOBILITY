// src/locations/controllers/service-zones.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import {RolesGuard} from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { ServiceZonesService } from '../services/service-zones.service';
import { CreateServiceZoneDto } from '../dto/create-service-zone.dto';

@ApiTags('Service Zones')
@Controller('locations/zones')
export class ServiceZonesController {
  constructor(private readonly serviceZonesService: ServiceZonesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Créer une zone de service (Admin)' })
  create(@Body() dto: CreateServiceZoneDto) {
    return this.serviceZonesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des zones de service' })
  findAll(
    @Query('country') country?: string,
    @Query('city') city?: string,
  ) {
    return this.serviceZonesService.findAll(country, city);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une zone de service' })
  findOne(@Param('id') id: string) {
    return this.serviceZonesService.findById(id);
  }

  @Get('location/:lat/:lng')
  @ApiOperation({ summary: 'Trouver zone par coordonnées' })
  findByLocation(
    @Param('lat') lat: string,
    @Param('lng') lng: string,
  ) {
    return this.serviceZonesService.findZoneByLocation({
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
    });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Modifier une zone de service (Admin)' })
  update(@Param('id') id: string, @Body() dto: Partial<CreateServiceZoneDto>) {
    return this.serviceZonesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Désactiver une zone de service (Admin)' })
  remove(@Param('id') id: string) {
    return this.serviceZonesService.delete(id);
  }
}