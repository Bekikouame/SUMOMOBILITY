// src/payments/guards/payment-security.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';
import { PAYMENT_SECURITY_KEY } from '../decorators/payment-security.decorator';
import { UserRole } from '@prisma/client';

@Injectable()
export class PaymentSecurityGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredLevel = this.reflector.getAllAndOverride<string>(
      PAYMENT_SECURITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredLevel) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    switch (requiredLevel) {
      case 'ADMIN':
        return user.role === UserRole.ADMIN;
        
      case 'WRITE':
        // Peut écrire si admin ou si c'est son propre paiement
        if (user.role === UserRole.ADMIN) return true;
        return await this.canAccessPayment(user, request.params.id);
        
      case 'READ':
        if (user.role === UserRole.ADMIN) return true;
        return await this.canAccessPayment(user, request.params.id);
        
      default:
        return false;
    }
  }

  private async canAccessPayment(user: any, paymentId: string): Promise<boolean> {
    if (!paymentId) return true; // Pas de restriction si pas d'ID spécifique

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        ridePayments: {
          include: {
            ride: {
              include: {
                client: true,
                driver: true,
              },
            },
          },
        },
        reservationPayments: {
          include: {
            reservation: {
              include: {
                client: true,
              },
            },
          },
        },
      },
    });

    if (!payment) return false;

    // Vérifier si l'utilisateur est lié au paiement
    const userProfiles = await this.prisma.user.findUnique({
      where: { id: user.sub },
      include: {
        clientProfile: true,
        driverProfile: true,
      },
    });

    if (!userProfiles) return false;

    // Client peut voir ses propres paiements
    if (userProfiles.clientProfile) {
      const isOwner = payment.ridePayments.some(rp => 
        rp.ride.clientId === userProfiles.clientProfile!.id
      ) || payment.reservationPayments.some(rp => 
        rp.reservation.clientId === userProfiles.clientProfile!.id
      );
      if (isOwner) return true;
    }

    // Chauffeur peut voir les paiements de ses courses
    if (userProfiles.driverProfile) {
      const isDriver = payment.ridePayments.some(rp => 
        rp.ride.driverId === userProfiles.driverProfile!.id
      );
      if (isDriver) return true;
    }

    return false;
  }
}