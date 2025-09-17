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
  BadRequestException,
  ConflictException,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {  RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyAccountDto } from './dto/verify-account.dto';
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
  ApiUnauthorizedResponse
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
    } catch (error) {
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
    } catch (error) {
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





  @Public()
  @Post('verify-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Vérification de compte',
    description: 'Vérification du compte utilisateur avec un code (à implémenter plus tard).'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Compte vérifié avec succès',
    schema: {
      example: {
        success: true,
        message: 'Compte vérifié avec succès'
      }
    }
  })
  async verifyAccount(@Body() verificationData: { email: string; code: string }) {
    // la logique de vérification
    return {
      success: true,
      message: 'Compte vérifié avec succès'
    };
  }
}