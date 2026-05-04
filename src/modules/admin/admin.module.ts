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
import { EmailModule } from '../email/email.module';
import { DocumentsModule } from 'src/documents/documents.module';
import { DriverManagementController } from './controllers/driver-management.controller';
import { DriverManagementService } from './services/driver-management.service';


@Module({
  imports: [PrismaModule, EmailModule,DocumentsModule,
    ],
  providers: [
    DashboardService,
    UserManagementService,
    SystemConfigService,
    ReportsService,
    AdminLogService,
    AutoApprovalService,
    DriverManagementService,
  ],
  controllers: [
    DashboardController,
    UserManagementController,
    SystemConfigController,
    ReportsController,
    AdminLogsController,
    ApprovalController,
    DriverManagementController,
  ],
  exports: [
    DashboardService,
    UserManagementService,
    SystemConfigService,
    ReportsService,
    AdminLogService,
    AutoApprovalService,
    DriverManagementService,
  ],
})
export class AdminModule {}
