// src/vehicles/guards/vehicle-owner.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class VehicleOwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const vehicleId = request.params.id;

    // Les admins ont accès à tout
    if (user.role === UserRole.ADMIN) {
      return true;
    }

    // Pour les chauffeurs, vérifier la propriété
    if (user.role === UserRole.DRIVER) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId: user.id }
      });

      if (!driver) {
        throw new ForbiddenException('Profil chauffeur non trouvé');
      }

      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: vehicleId }
      });

      if (!vehicle || vehicle.driverId !== driver.id) {
        throw new ForbiddenException('Accès non autorisé à ce véhicule');
      }

      return true;
    }

    return false;
  }
}