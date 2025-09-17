// src/admin/controllers/reports.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard} from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { ReportsService } from '../services/reports.service';
import { GenerateReportDto } from '../dto/report.dto';

@ApiTags('Admin Reports')
@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Générer un rapport' })
  generateReport(
    @Body() dto: GenerateReportDto,
    @CurrentUser() admin: any,
  ) {
    return this.reportsService.generateReport(dto, admin.id);
  }

  @Get()
  @ApiOperation({ summary: 'Liste des rapports' })
  getReports(
    @Query('adminId') adminId?: string,
    @Query('type') type?: string,
  ) {
    return this.reportsService.getReports(adminId, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détails d\'un rapport' })
  getReport(@Param('id') id: string) {
    return this.reportsService.getReport(id);
  }
}