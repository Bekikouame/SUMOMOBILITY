// src/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';

import { DashboardService } from './services/dashboard.service';
import { UserManagementService } from './services/user-management.service';
import { SystemConfigService } from './services/system-config.service';
import { ReportsService } from './services/reports.service';
import { AdminLogService } from './services/admin-log.service';

import { DashboardController } from './controllers/dashboard.controller';
import { UserManagementController } from './controllers/user-management.controller';
import { SystemConfigController } from './controllers/system-config.controller';
import { ReportsController } from './controllers/reports.controller';
import { AdminLogsController } from './controllers/admin-logs.controller';
import { AutoApprovalService } from './services/auto-approval.service';
import { ApprovalController } from './controllers/approval.controller';

@Module({
  imports: [PrismaModule],
  providers: [
    DashboardService,
    UserManagementService,
    SystemConfigService,
    ReportsService,
    AdminLogService,
    AutoApprovalService
  ],
  controllers: [
    DashboardController,
    UserManagementController,
    SystemConfigController,
    ReportsController,
    AdminLogsController,
    ApprovalController,
    
  ],
  exports: [
    DashboardService,
    UserManagementService,
    SystemConfigService,
    ReportsService,
    AdminLogService,
    AutoApprovalService,
  ],
})
export class AdminModule {}
