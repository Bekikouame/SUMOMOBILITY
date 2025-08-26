// src/documents/documents.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  HttpStatus,
  ParseUUIDPipe
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiParam, ApiQuery } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Documents')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload un document' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Document uploadé avec succès' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Fichier invalide' })
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadDocumentDto,
    @Req() req: any
  ) {
    const user = req.user;
    return this.documentsService.uploadDocument(file, uploadDto, user.id, user.role);
  }

  @Get('types')
  @ApiOperation({ summary: 'Lister les types de documents configurés' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Types de documents' })
  getDocumentTypes() {
    return this.documentsService.getDocumentTypes();
  }

  @Get('statistics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Statistiques des documents (admin)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Statistiques des documents' })
  async getStatistics() {
    return this.documentsService.getDocumentStatistics();
  }

  @Get('pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Documents en attente de validation (admin)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Documents en attente' })
  async getPendingDocuments(@Query() query: QueryDocumentsDto) {
    return this.documentsService.getPendingDocuments(query);
  }

  @Get('expiring')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DRIVER)
  @ApiOperation({ summary: 'Documents qui expirent bientôt' })
  @ApiQuery({ name: 'expiringInDays', required: false, description: 'Nombre de jours avant expiration', example: '30' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Documents expirant bientôt' })
  async getExpiringDocuments(@Query() query: QueryDocumentsDto) {
    return this.documentsService.getExpiringDocuments(query);
  }

  @Get('all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Tous les documents avec filtres (admin)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Liste de tous les documents' })
  async getAllDocuments(@Query() query: QueryDocumentsDto) {
    return this.documentsService.getAllDocuments(query);
  }

  @Get('driver/:driverId')
  @ApiOperation({ summary: 'Documents d\'un chauffeur spécifique' })
  @ApiParam({ name: 'driverId', description: 'ID du chauffeur' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Documents du chauffeur' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Accès non autorisé' })
  async getDriverDocuments(
    @Param('driverId', ParseUUIDPipe) driverId: string,
    @Req() req: any
  ) {
    const user = req.user;
    return this.documentsService.getDriverDocuments(driverId, user.id, user.role);
  }

  @Patch(':id/review')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Valider ou rejeter un document (admin)' })
  @ApiParam({ name: 'id', description: 'ID du document' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Document révisé avec succès' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Document non trouvé' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Accès admin requis' })
  async reviewDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() reviewDto: ReviewDocumentDto,
    @Req() req: any
  ) {
    const admin = req.user;
    return this.documentsService.reviewDocument(id, reviewDto, admin.id);
  }
}