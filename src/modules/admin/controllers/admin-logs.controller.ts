// src/modules/admin/controllers/admin-logs.controller.ts

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminLogService } from '../services/admin-log.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';

@Controller('admin/logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminLogsController {
  constructor(private readonly adminLogService: AdminLogService) {}

  /**
   * GET /admin/logs
   * Récupérer tous les logs ou les logs d'un admin spécifique
   */
  @Get()
  async getLogs(
    @Query('adminId') adminId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminLogService.getLogs(
      adminId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }

  /**
   * GET /admin/logs/statistics
   * Statistiques des logs
   */
  @Get('statistics')
  async getStatistics() {
    return this.adminLogService.getLogStatistics();
  }

  /**
   * GET /admin/logs/search
   * Rechercher dans les logs
   */
  @Get('search')
  async searchLogs(
    @Query('q') searchTerm: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminLogService.searchLogs(
      searchTerm,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
    );
  }
}