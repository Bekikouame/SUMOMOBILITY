// src/modules/auth/auth.controller.ts
import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Get,
  UnauthorizedException,
  ConflictException,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Créer un nouveau compte utilisateur',
    description: 'Permet de créer un compte client ou chauffeur. Les chauffeurs sont créés avec le statut PENDING en attente de validation.'
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Utilisateur créé avec succès',
    schema: {
      example: {
        success: true,
        message: 'Compte créé avec succès',
        data: {
          user: {
            id: 'cm4abc123def456',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+225123456789',
            role: 'CLIENT',
            isActive: true,
            country: 'Côte d\'Ivoire',
            city: 'Abidjan',
            region: 'Cocody',
            createdAt: '2024-01-15T10:30:00.000Z'
          },
          tokens: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            expiresIn: '15m'
          }
        }
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Données invalides',
    schema: {
      example: {
        success: false,
        message: 'Données de validation invalides',
        errors: [
          'Le mot de passe doit contenir au moins 8 caractères',
          'Le numéro de téléphone doit être au format international'
        ]
      }
    }
  })
  @ApiConflictResponse({ 
    description: 'Email ou téléphone déjà utilisé',
    schema: {
      example: {
        success: false,
        message: 'Cet email est déjà utilisé'
      }
    }
  })
  async register(@Body() registerDto: RegisterDto) {
    try {
      const result = await this.authService.register(registerDto);
      return {
        success: true,
        message: 'Compte créé avec succès',
        data: result
      };
    } catch (error) {
      if (error.code === 'P2002') { // Prisma unique constraint error
        const field = error.meta?.target?.[0];
        const message = field === 'email' 
          ? 'Cet email est déjà utilisé'
          : 'Ce numéro de téléphone est déjà utilisé';
        throw new ConflictException(message);
      }
      throw error;
    }
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Connexion utilisateur',
    description: 'Authentification par email/téléphone et mot de passe. Retourne les tokens d\'accès et de rafraîchissement.'
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Connexion réussie',
    schema: {
      example: {
        success: true,
        message: 'Connexion réussie',
        data: {
          user: {
            id: 'cm4abc123def456',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+225123456789',
            role: 'CLIENT',
            isActive: true,
            lastLoginAt: '2024-01-15T10:30:00.000Z'
          },
          tokens: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            expiresIn: '15m'
          }
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ 
    description: 'Identifiants invalides',
    schema: {
      example: {
        success: false,
        message: 'Email ou mot de passe incorrect'
      }
    }
  })
  async login(@Body() loginDto: LoginDto) {
    try {
      const result = await this.authService.login(loginDto);
      return {
        success: true,
        message: 'Connexion réussie',
        data: result
      };
    } catch {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Rafraîchir le token d\'accès',
    description: 'Génère un nouveau token d\'accès à partir du refresh token.'
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Token rafraîchi avec succès',
    schema: {
      example: {
        success: true,
        message: 'Token rafraîchi avec succès',
        data: {
          accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
          expiresIn: '15m'
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ 
    description: 'Refresh token invalide ou expiré',
    schema: {
      example: {
        success: false,
        message: 'Token de rafraîchissement invalide'
      }
    }
  })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    try {
      const result = await this.authService.refreshTokens(refreshTokenDto.refreshToken);
      return {
        success: true,
        message: 'Token rafraîchi avec succès',
        data: result
      };
    } catch {
      throw new UnauthorizedException('Token de rafraîchissement invalide');
    }
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ 
    summary: 'Obtenir les informations de l\'utilisateur connecté',
    description: 'Retourne le profil complet de l\'utilisateur authentifié avec ses relations (clientProfile, driverProfile).'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profil utilisateur récupéré',
    schema: {
      example: {
        success: true,
        data: {
          id: 'cm4abc123def456',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+225123456789',
          role: 'CLIENT',
          isActive: true,
          country: 'Côte d\'Ivoire',
          city: 'Abidjan',
          region: 'Cocody',
          lastLoginAt: '2024-01-15T10:30:00.000Z',
          createdAt: '2024-01-10T08:15:30.000Z',
          updatedAt: '2024-01-15T10:30:00.000Z',
          clientProfile: {
            id: 'cm4client123',
            loyaltyPoints: 150,
            vipStatus: false,
            preferredPaymentMethod: 'MOBILE_MONEY',
            defaultPickupAddress: 'Cocody, Abidjan'
          },
          driverProfile: null
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token d\'accès invalide ou manquant' })
  async getProfile(@CurrentUser() user: any) {
    const profile = await this.authService.getProfile(user.id);
    return {
      success: true,
      data: profile
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Déconnexion utilisateur',
    description: 'Invalide le refresh token de l\'utilisateur et met à jour son activité.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Déconnexion réussie',
    schema: {
      example: {
        success: true,
        message: 'Déconnexion réussie'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token d\'accès invalide' })
  async logout(@CurrentUser() user: any) {
    await this.authService.logout(user.id);
    return {
      success: true,
      message: 'Déconnexion réussie'
    };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Demande de réinitialisation de mot de passe',
    description: 'Envoie un code de réinitialisation par email.'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Code de réinitialisation envoyé',
    schema: {
      example: {
        success: true,
        message: 'Un code de réinitialisation a été envoyé à votre email'
      }
    }
  })
  @ApiBadRequestResponse({ 
  description: 'Email invalide',
  schema: {
    example: {
      success: false,
      message: 'Format d\'email invalide'
    }
  }
})
  async forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: any) {
  return this.authService.forgotPassword(dto, req);
}


@Public()
@Post('reset-password')
@HttpCode(HttpStatus.OK)
@ApiOperation({ 
  summary: 'Réinitialiser le mot de passe avec le code PIN',
  description: 'Utilise le code reçu par email pour définir un nouveau mot de passe'
})
@ApiBody({ type: ResetPasswordDto })
@ApiResponse({ 
  status: 200, 
  description: 'Mot de passe mis à jour avec succès',
  schema: {
    example: {
      success: true,
      message: 'Mot de passe mis à jour avec succès'
    }
  }
})
@ApiBadRequestResponse({ 
  description: 'Code invalide, expiré ou mot de passe faible',
  schema: {
    example: {
      success: false,
      message: 'Code invalide ou expiré'
    }
  }
})
async resetPassword(@Body() dto: ResetPasswordDto, @Req() req: any) {
  return this.authService.resetPassword(dto, req);
}





  // ─────────────────────────────────────────────
  //  AUTHENTIFICATION PAR OTP (sans mot de passe)
  // ─────────────────────────────────────────────

  @Public()
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demander un code OTP par SMS',
    description: 'Envoie un code à 6 chiffres valable 5 minutes. Limité à 3 demandes par fenêtre de 5 minutes.',
  })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({
    status: 200,
    description: 'Code OTP envoyé',
    schema: { example: { success: true, message: 'Code OTP envoyé par SMS', expiresIn: 300 } },
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de demandes — attendre 5 minutes' })
  async sendOtp(@Body() dto: SendOtpDto) {
    const result = await this.authService.sendOtp(dto);
    return { success: true, ...result };
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Renvoyer un code OTP',
    description: 'Invalide le code précédent et en envoie un nouveau. Soumis aux mêmes limites de débit.',
  })
  @ApiBody({ type: SendOtpDto })
  @ApiResponse({
    status: 200,
    description: 'Nouveau code OTP envoyé',
    schema: { example: { success: true, message: 'Code OTP envoyé par SMS', expiresIn: 300 } },
  })
  @ApiTooManyRequestsResponse({ description: 'Trop de demandes — attendre 5 minutes' })
  async resendOtp(@Body() dto: SendOtpDto) {
    const result = await this.authService.sendOtp(dto);
    return { success: true, ...result };
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vérifier le code OTP et se connecter',
    description: `Vérifie le code OTP.
- Si l'utilisateur n'existe pas, le crée avec les informations fournies (firstName et lastName requis).
- Retourne un token JWT en cas de succès.
- Limité à 3 tentatives par code.
- Les chauffeurs sont bloqués si leur compte n'est pas encore validé (status APPROVED).`,
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiResponse({
    status: 200,
    description: 'Authentification réussie',
    schema: {
      example: {
        success: true,
        message: 'Connexion réussie',
        data: {
          user: { id: 'cuid', firstName: 'John', lastName: 'Doe', phone: '+2250123456789', role: 'CLIENT' },
          tokens: { accessToken: 'eyJ...', refreshToken: 'eyJ...', expiresIn: '30d' },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Code invalide, expiré ou informations manquantes' })
  @ApiUnauthorizedResponse({ description: 'Code OTP incorrect' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const result = await this.authService.verifyOtp(dto);
    return { success: true, message: 'Connexion réussie', data: result };
  }
}