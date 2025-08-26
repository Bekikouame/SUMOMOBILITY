// src/vehicles/vehicles.controller.ts
import {
  Controller, Get, Post, Body, Patch, Param, Delete,
  UseGuards, Req, HttpStatus, ParseUUIDPipe, NotFoundException
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam
} from '@nestjs/swagger';
import { VehiclesService } from '../vehicules/vehicules.service';
import { CreateVehicleDto } from '../vehicules/dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../vehicules/dto/update-vehicle.dto';
import { VerifyVehicleDto } from '../vehicules/dto/verify-vehicle.dto';
import { UpdateVehicleStatusDto } from '../vehicules/dto/update-status.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('Vehicles')
@Controller('vehicles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class VehiclesController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly prisma: PrismaService
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Ajouter un véhicule (chauffeur uniquement)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Véhicule créé avec succès' })
  async create(@Body() createVehicleDto: CreateVehicleDto, @Req() req: any) {
    const user = req.user;
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId: user.id }
    });

    if (!driver) throw new NotFoundException('Profil chauffeur non trouvé');

    return this.vehiclesService.create(driver.id, createVehicleDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Lister les véhicules' })
  async findAll(@Req() req: any) {
    const user = req.user;
    return this.vehiclesService.findAll(user.id, user.role);
  }

  @Get('statistics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques des véhicules (admin uniquement)' })
  async getStatistics() {
    return this.vehiclesService.getStatistics();
  }

  @Get('available')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Véhicules disponibles pour matching' })
  async findAvailable() {
    return this.vehiclesService.findAvailableVehicles();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'un véhicule' })
  @ApiParam({ name: 'id', description: 'ID du véhicule' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const user = req.user;
    return this.vehiclesService.findOne(id, user.id, user.role);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Modifier un véhicule' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
    @Req() req: any
  ) {
    const user = req.user;
    return this.vehiclesService.update(id, updateVehicleDto, user.id, user.role);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Changer le statut d\'un véhicule' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateVehicleStatusDto,
    @Req() req: any
  ) {
    const user = req.user;
    return this.vehiclesService.updateStatus(id, updateStatusDto, user.id, user.role);
  }

  @Patch(':id/verify')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Vérifier un véhicule (admin uniquement)' })
  async verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() verifyVehicleDto: VerifyVehicleDto
  ) {
    return this.vehiclesService.verify(id, verifyVehicleDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un véhicule' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const user = req.user;
    return this.vehiclesService.remove(id, user.id, user.role);
  }
}
