// src/admin/middleware/maintenance.middleware.ts
import { Injectable, NestMiddleware, ServiceUnavailableException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { SystemConfigService } from '../services/system-config.service';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private systemConfig: SystemConfigService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Ignorer les routes admin pendant la maintenance
    if (req.path.startsWith('/admin')) {
      return next();
    }

    const isMaintenanceMode = await this.systemConfig.getValue('MAINTENANCE_MODE', false);
    
    if (isMaintenanceMode) {
      const message = await this.systemConfig.getValue(
        'MAINTENANCE_MESSAGE',
        'Service temporairement indisponible'
      );
      
      throw new ServiceUnavailableException(message);
    }

    next();
  }
}