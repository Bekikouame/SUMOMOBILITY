// src/modules/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../interfaces/auth.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
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
  async validate(payload: JwtPayload) {
    // Valider que l'utilisateur existe toujours et est actif
    const user = await this.authService.validateUser(payload);
    
    if (!user) {
      throw new UnauthorizedException('Token invalide ou utilisateur introuvable');
    }
    
    // L'objet retourné sera attaché à req.user
    return { sub: user.id, email: user.email, role: user.role };
  }
}