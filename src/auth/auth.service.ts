// src/modules/auth/auth.service.ts
import { 
  Injectable, 
  ConflictException, 
  UnauthorizedException, 
  NotFoundException,
  BadRequestException 
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto, } from './dto/register.dto';
import { LoginDto} from './dto/login.dto';
import { JwtPayload, AuthResponse, TokenPair } from './interfaces/auth.interface';
import { $Enums, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../modules/email/email.service';
import {ForgotPasswordDto} from "./dto/forgot-password.dto"
import {ResetPasswordDto} from "./dto/reset-password.dto"

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
  ) {}

  /**
   * Inscription d'un nouvel utilisateur
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { email, phone, password, role = UserRole.CLIENT, ...userData } = registerDto;

    // Vérifier si l'email existe déjà
    const existingUserByEmail = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUserByEmail) {
      throw new ConflictException('Cet email est déjà utilisé');
    }

    // Vérifier si le téléphone existe déjà
    const existingUserByPhone = await this.prisma.user.findUnique({
      where: { phone },
    });

    if (existingUserByPhone) {
      throw new ConflictException('Ce numéro de téléphone est déjà utilisé');
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur avec transaction pour assurer la cohérence
    const user = await this.prisma.$transaction(async (tx) => {
      // Créer l'utilisateur
      const newUser = await tx.user.create({
        data: {
          ...userData,
          email,
          phone,
          passwordHash: hashedPassword,
          role,
          lastLoginAt: new Date(),
        },
      });

      // Créer le profil spécialisé selon le rôle
      if (role === UserRole.CLIENT) {
        await tx.clientProfile.create({
          data: {
            userId: newUser.id,
            loyaltyPoints: 0,
            vipStatus: false,
          },
        });
      } else if (role === UserRole.DRIVER) {
        await tx.driverProfile.create({
          data: {
            userId: newUser.id,
            status: 'PENDING', // En attente de validation
            totalRides: 0,
            totalEarnings: 0,
          },
        });
      }

      return newUser;
    });

    // Générer les tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // Retourner la réponse sans le hash du mot de passe
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Connexion utilisateur
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { identifier, password } = loginDto;

    // Chercher l'utilisateur par email ou téléphone
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { phone: identifier },
        ],
        isActive: true, // Seuls les comptes actifs peuvent se connecter
      },
    });

    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    // Mettre à jour la dernière connexion
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Générer les tokens
    const tokens = await this.generateTokens({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // Retourner la réponse sans le hash du mot de passe
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  /**
   * Rafraîchir les tokens d'accès
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    try {
      // Vérifier et décoder le refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // Vérifier que l'utilisateur existe toujours et est actif
      const user = await this.prisma.user.findUnique({
        where: { 
          id: payload.sub,
          isActive: true,
        },
      });

      if (!user) {
        throw new UnauthorizedException('Utilisateur introuvable');
      }

      // Générer de nouveaux tokens
      return this.generateTokens({
        sub: user.id,
        email: user.email,
        role: user.role,
      });

    } catch (error) {
      throw new UnauthorizedException('Token de rafraîchissement invalide');
    }
  }

  /**
   * Obtenir le profil complet d'un utilisateur
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: true,
        driverProfile: {
          include: {
            documents: {
              select: {
                id: true,
                docType: true,
                status: true,
                expiresAt: true,
                createdAt: true,
              },
            },
            vehicles: {
              select: {
                id: true,
                plateNumber: true,
                brand: true,
                model: true,
                color: true,
                status: true,
                verified: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Exclure le hash du mot de passe
    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  /**
   * Déconnexion utilisateur
   */
  async logout(userId: string): Promise<{ message: string }> {
    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Dans une implémentation complète, on pourrait :
    // - Blacklister le refresh token
    // - Enregistrer l'heure de déconnexion
    // - Invalider les sessions actives

    // Pour l'instant, on se contente de confirmer la déconnexion
    return { message: 'Déconnexion réussie' };
  }

  /**
   * Générer les tokens JWT (access + refresh)
   */
  private async generateTokens(payload: JwtPayload): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      // Access Token (courte durée)
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      }),
      // Refresh Token (longue durée)
      this.jwtService.signAsync(
        { ...payload, type: 'refresh' },
        {
          secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
          expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        }
      ),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Valider un utilisateur pour la stratégie JWT
   */
  async validateUser(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { 
        id: payload.sub,
        isActive: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        country: true,
        city: true,
        region: true,
      },
    });

    if (!user) {
      return null;
    }

    return user;
  }

  /**
   * Vérifier si un email existe déjà
   */
  async isEmailTaken(email: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    return !!user;
  }

  /**
   * Vérifier si un téléphone existe déjà
   */
  async isPhoneTaken(phone: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { phone },
    });
    return !!user;
  }

  /**
   * Changer le mot de passe
   * 
   * 
   * 
   * 
   */
  async forgotPassword(dto: ForgotPasswordDto, req: any) {
  const { email } = dto;

  const user = await this.prisma.user.findUnique({
    where: { email }
  });

  // Toujours retourner succès
  const response = {
    success: true,
    message: 'Si cet email existe, vous recevrez un code de réinitialisation'
  };

  if (!user) {
    return response;
  }

  // Rate limiting
  const recentCodes = await this.prisma.passwordResetCode.count({
    where: {
      userId: user.id,
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }
    }
  });

  if (recentCodes >= 3) {
    return response;
  }

  // Invalider anciens codes
  await this.prisma.passwordResetCode.updateMany({
    where: { userId: user.id, used: false },
    data: { used: true }
  });

  // Générer code 6 chiffres
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Sauvegarder code
  await this.prisma.passwordResetCode.create({
    data: {
      userId: user.id,
      code: resetCode,
      email: user.email,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000)
    }
  });

  // Envoyer email
  const userName = `${user.firstName} ${user.lastName}`;
  await this.emailService.sendResetCode(user.email, resetCode, userName);

  return response;
}

async resetPassword(dto: ResetPasswordDto, req: any) {
  const { code, newPassword } = dto;

  // Rechercher code valide
  const codeRecord = await this.prisma.passwordResetCode.findFirst({
    where: {
      code,
      used: false,
      expiresAt: { gt: new Date() }
    },
    include: { user: true }
  });

  if (!codeRecord) {
    throw new BadRequestException('Code invalide ou expiré');
  }

  // Vérifier tentatives
  if (codeRecord.attempts >= 3) {
    await this.prisma.passwordResetCode.update({
      where: { id: codeRecord.id },
      data: { used: true }
    });
    throw new BadRequestException('Trop de tentatives');
  }

  // Transaction
  await this.prisma.$transaction(async (tx) => {
    // Incrémenter tentatives
    await tx.passwordResetCode.update({
      where: { id: codeRecord.id },
      data: { attempts: codeRecord.attempts + 1 }
    });

    // Hash nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour utilisateur
    await tx.user.update({
      where: { id: codeRecord.userId },
      data: { passwordHash: hashedPassword }
    });

    // Marquer code comme utilisé
    await tx.passwordResetCode.update({
      where: { id: codeRecord.id },
      data: { used: true }
    });
  });

  return {
    success: true,
    message: 'Mot de passe mis à jour avec succès'
  };
}







  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier l'ancien mot de passe
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);

    if (!isOldPasswordValid) {
      throw new BadRequestException('Ancien mot de passe incorrect');
    }

    // Hasher et sauvegarder le nouveau mot de passe
    const newPasswordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });
  }
}