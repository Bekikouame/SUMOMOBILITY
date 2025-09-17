// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../interfaces/auth.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    // Obtenir la clé secrète et vérifier si elle est définie
    const jwtSecret = configService.get<string>('JWT_SECRET');

    if (!jwtSecret) {
      // Lancer une erreur si la clé secrète est manquante
      throw new Error('La variable d\'environnement JWT_SECRET est manquante.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  /**
   * Validation du payload JWT
   * Cette méthode est appelée automatiquement après la vérification du token
   */
 // auth/strategies/jwt.strategy.ts
async validate(payload: any) {
  console.log('JWT Strategy - payload reçu:', payload);
  
  // Le payload JWT contient généralement { sub: userId, ... }
  const userId = payload.sub || payload.id || payload.userId;
  
  if (!userId) {
    throw new UnauthorizedException('Token JWT invalide - pas d\'ID utilisateur');
  }

  // Vérifier que l'utilisateur existe
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, isActive: true }
  });

  if (!user || !user.isActive) {
    throw new UnauthorizedException('Utilisateur non trouvé ou inactif');
  }

  // IMPORTANT : Ce qui est retourné ici devient req.user
  return {
    id: user.id,     // <- ou 'sub: user.id' selon votre préférence
    sub: user.id,    // <- si vous voulez garder 'sub'
    email: user.email,
    role: user.role
  };
}
}