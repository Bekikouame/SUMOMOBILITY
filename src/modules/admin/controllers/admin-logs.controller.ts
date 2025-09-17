// src/admin/controllers/admin-logs.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard} from '../../../auth/guards/jwt-auth.guard';
import {RolesGuard} from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { AdminLogService } from '../services/admin-log.service';

@ApiTags('Admin Logs')
@Controller('admin/logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class AdminLogsController {
  constructor(private readonly adminLogService: AdminLogService) {}

  @Get()
  @ApiOperation({ summary: 'Logs d\'activité admin' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'adminId', required: false })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'resource', required: false })
  getLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('adminId') adminId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
  ) {
    return this.adminLogService.getLogs(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      adminId,
      action,
      resource,
    );
  }
}
