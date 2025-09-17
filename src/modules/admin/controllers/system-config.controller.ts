// src/admin/controllers/system-config.controller.ts
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard} from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { SystemConfigService } from '../services/system-config.service';
import { CreateSystemConfigDto, UpdateSystemConfigDto } from '../dto/system-config.dto';

@ApiTags('Admin System Config')
@Controller('admin/config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Post()
  @ApiOperation({ summary: 'Créer une configuration' })
  create(
    @Body() dto: CreateSystemConfigDto,
    @CurrentUser() admin: any,
  ) {
    return this.systemConfigService.create(dto, admin.id);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des configurations' })
  findAll(
    @Query('category') category?: string,
    @Query('isPublic') isPublic?: string,
  ) {
    return this.systemConfigService.findAll(
      category,
      isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
    );
  }

  @Get('public')
  @ApiOperation({ summary: 'Configurations publiques' })
  @Roles('CLIENT', 'DRIVER', 'ADMIN') // Accessible à tous
  getPublicConfigs() {
    return this.systemConfigService.getPublicConfigs();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Configuration par clé' })
  findByKey(@Param('key') key: string) {
    return this.systemConfigService.findByKey(key);
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Modifier une configuration' })
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSystemConfigDto,
    @CurrentUser() admin: any,
  ) {
    return this.systemConfigService.update(key, dto, admin.id);
  }

  @Delete(':key')
  @ApiOperation({ summary: 'Supprimer une configuration' })
  remove(@Param('key') key: string) {
    return this.systemConfigService.delete(key);
  }
}
