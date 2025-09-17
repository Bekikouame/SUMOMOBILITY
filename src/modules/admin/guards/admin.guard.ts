// src/admin/guards/super-admin.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SystemConfigService } from '../services/system-config.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private systemConfig: SystemConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenException('Accès réservé aux admins');
    }

    // Vérifier si l'utilisateur est super admin
    const superAdmins = await this.systemConfig.getValue('SUPER_ADMINS', []);
    
    if (!superAdmins.includes(user.id)) {
      throw new ForbiddenException('Accès réservé aux super admins');
    }

    return true;
  }
}