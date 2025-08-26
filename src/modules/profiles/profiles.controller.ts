// src/modules/profiles/profiles.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {  CreateClientProfileDto,UpdateClientProfileDto,} from './dto/client-profile.dto';
import {CreateDriverProfileDto,  UpdateDriverProfileDto,} from './dto/driver-profile.dto';
import {CreateDriverDocumentDto,UpdateDriverDocumentDto,} from './dto/driver-document.dto'



@ApiTags('Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  // ==================== CLIENT PROFILES ====================

  @Post('client')
  @ApiOperation({ summary: 'Créer un profil client' })
  @ApiResponse({ status: 201, description: 'Profil client créé avec succès' })
  @HttpCode(HttpStatus.CREATED)
  async createClientProfile(@Request() req, @Body() dto: CreateClientProfileDto) {
    return this.profilesService.createClientProfile(req.user.id, dto);
  }

  @Get('client/:id')
  @ApiOperation({ summary: 'Obtenir un profil client' })
  @ApiParam({ name: 'id', description: 'ID du profil client' })
  @ApiResponse({ status: 200, description: 'Profil client récupéré' })
  async getClientProfile(@Param('id') id: string, @Request() req) {
    return this.profilesService.getClientProfile(id, req.user.id);
  }

  @Patch('client/:id')
  @ApiOperation({ summary: 'Modifier un profil client' })
  @ApiParam({ name: 'id', description: 'ID du profil client' })
  @ApiResponse({ status: 200, description: 'Profil client modifié' })
  async updateClientProfile(
    @Param('id') id: string,
    @Body() dto: UpdateClientProfileDto,
    @Request() req,
  ) {
    return this.profilesService.updateClientProfile(id, dto, req.user.id);
  }

  @Get('client/:id/metrics')
  @ApiOperation({ summary: 'Obtenir les métriques du client' })
  @ApiParam({ name: 'id', description: 'ID du profil client' })
  @ApiResponse({ status: 200, description: 'Métriques du client' })
  async getClientMetrics(@Param('id') id: string, @Request() req) {
    return this.profilesService.getClientMetrics(id, req.user.id);
  }

  // ==================== DRIVER PROFILES ====================

  @Post('driver')
  @ApiOperation({ summary: 'Créer un profil chauffeur' })
  @ApiResponse({ status: 201, description: 'Profil chauffeur créé avec succès' })
  @HttpCode(HttpStatus.CREATED)
  async createDriverProfile(@Request() req, @Body() dto: CreateDriverProfileDto) {
    return this.profilesService.createDriverProfile(req.user.id, dto);
  }

  @Get('driver/:id')
  @ApiOperation({ summary: 'Obtenir un profil chauffeur' })
  @ApiParam({ name: 'id', description: 'ID du profil chauffeur' })
  @ApiResponse({ status: 200, description: 'Profil chauffeur récupéré' })
  async getDriverProfile(@Param('id') id: string, @Request() req) {
    return this.profilesService.getDriverProfile(id, req.user.id);
  }

  @Patch('driver/:id')
  @ApiOperation({ summary: 'Modifier un profil chauffeur' })
  @ApiParam({ name: 'id', description: 'ID du profil chauffeur' })
  @ApiResponse({ status: 200, description: 'Profil chauffeur modifié' })
  async updateDriverProfile(
    @Param('id') id: string,
    @Body() dto: UpdateDriverProfileDto,
    @Request() req,
  ) {
    return this.profilesService.updateDriverProfile(id, dto, req.user.id);
  }

  @Get('driver/:id/metrics')
  @ApiOperation({ summary: 'Obtenir les métriques du chauffeur' })
  @ApiParam({ name: 'id', description: 'ID du profil chauffeur' })
  @ApiResponse({ status: 200, description: 'Métriques du chauffeur' })
  async getDriverMetrics(@Param('id') id: string, @Request() req) {
    return this.profilesService.getDriverMetrics(id, req.user.id);
  }

  // ==================== DRIVER DOCUMENTS ====================

  @Get('driver/:id/documents')
  @ApiOperation({ summary: 'Obtenir les documents du chauffeur' })
  @ApiParam({ name: 'id', description: 'ID du profil chauffeur' })
  @ApiResponse({ status: 200, description: 'Documents du chauffeur' })
  async getDriverDocuments(@Param('id') id: string, @Request() req) {
    return this.profilesService.getDriverDocuments(id, req.user.id);
  }

  @Post('driver/:id/documents')
  @ApiOperation({ summary: 'Ajouter un document chauffeur' })
  @ApiParam({ name: 'id', description: 'ID du profil chauffeur' })
  @ApiResponse({ status: 201, description: 'Document ajouté avec succès' })
  @HttpCode(HttpStatus.CREATED)
  async createDriverDocument(
    @Param('id') id: string,
    @Body() dto: CreateDriverDocumentDto,
    @Request() req,
  ) {
    return this.profilesService.createDriverDocument(id, dto, req.user.id);
  }

  @Patch('documents/:documentId')
  @ApiOperation({ summary: 'Modifier un document chauffeur' })
  @ApiParam({ name: 'documentId', description: 'ID du document' })
  @ApiResponse({ status: 200, description: 'Document modifié' })
  async updateDriverDocument(
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDriverDocumentDto,
    @Request() req,
  ) {
    return this.profilesService.updateDriverDocument(documentId, dto, req.user.id);
  }

  // ==================== ADMIN ROUTES ====================

  @Get('admin/expired-documents')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Obtenir les documents expirés (Admin)' })
  @ApiResponse({ status: 200, description: 'Documents expirés' })
  async getExpiredDocuments() {
    return this.profilesService.getExpiredDocuments();
  }
}