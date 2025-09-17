// src/admin/interceptors/admin-action.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { AdminLogService } from '../services/admin-log.service';

@Injectable()
export class AdminActionInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private adminLogService: AdminLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    // Seulement pour les admins
    if (!user || user.role !== 'ADMIN') {
      return next.handle();
    }

    const action = this.reflector.get<string>('admin-action', context.getHandler());
    if (!action) {
      return next.handle();
    }

    const method = request.method;
    const url = request.url;
    const body = request.body;

    return next.handle().pipe(
      tap(() => {
        // Log de l'action après succès
        this.adminLogService.log(user.id, {
          action,
          resource: this.extractResource(url),
          newValues: body,
          ipAddress: request.ip,
          userAgent: request.get('User-Agent'),
        });
      }),
    );
  }

  private extractResource(url: string): string {
    const parts = url.split('/');
    if (parts.includes('users')) return 'USER';
    if (parts.includes('drivers')) return 'DRIVER';
    if (parts.includes('rides')) return 'RIDE';
    if (parts.includes('config')) return 'CONFIG';
    return 'UNKNOWN';
  }
}

// Décorateur pour marquer les actions à logger
import { SetMetadata } from '@nestjs/common';
export const AdminAction = (action: string) => SetMetadata('admin-action', action);
