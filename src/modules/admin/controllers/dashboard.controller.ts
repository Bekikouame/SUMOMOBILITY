// src/admin/controllers/dashboard.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard} from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { DashboardService } from '../services/dashboard.service';
import { DashboardFilterDto } from '../dto/dashboard-filter.dto';

@ApiTags('Admin Dashboard')
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Statistiques générales' })
  getOverview(@Query() filters: DashboardFilterDto) {
    return this.dashboardService.getOverviewStats(filters);
  }

  @Get('rides-chart')
  @ApiOperation({ summary: 'Données graphique des courses' })
  getRidesChart(@Query() filters: DashboardFilterDto) {
    return this.dashboardService.getRidesChartData(filters);
  }

  @Get('top-drivers')
  @ApiOperation({ summary: 'Top chauffeurs' })
  getTopDrivers(@Query('limit') limit?: string) {
    return this.dashboardService.getTopDrivers(
      limit ? parseInt(limit) : 10
    );
  }

  @Get('recent-activity')
  @ApiOperation({ summary: 'Activité récente' })
  getRecentActivity(@Query('limit') limit?: string) {
    return this.dashboardService.getRecentActivity(
      limit ? parseInt(limit) : 20
    );
  }

  @Get('geographic-stats')
  @ApiOperation({ summary: 'Statistiques par zone géographique' })
  getGeographicStats() {
    return this.dashboardService.getGeographicStats();
  }
}
