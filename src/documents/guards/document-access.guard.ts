import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class DocumentAccessGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const driverId = request.params.driverId;

    // Les admins ont accès à tout
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Pour les chauffeurs, vérifier qu'ils accèdent à leurs propres documents
    if (user.role === UserRole.DRIVER) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId: user.id }
      });

      if (!driver || driver.id !== driverId) {
        throw new ForbiddenException('Accès non autorisé à ces documents');
      }

      return true;
    }

    return false;
  }
}