import { UserRole } from '@prisma/client';

/**
 * Payload JWT pour l'access token
 */
export interface JwtPayload {
  sub: string;        // User ID
  email: string;      // Email utilisateur
  role: UserRole;     // Rôle utilisateur
  iat?: number;       // Issued at (généré automatiquement)
  exp?: number;       // Expires at (généré automatiquement)
  type?: string;      // Type de token (pour le refresh token)
}

/**
 * Réponse complète d'authentification
 */
export interface AuthResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: UserRole;
    isActive: boolean;
    country?: string | null;
    city?: string | null;
    region?: string | null;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt?: Date | null;
  };
  tokens: TokenPair;
}

/**
 * Paire de tokens (access + refresh)
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Utilisateur simplifié pour les responses
 */
export interface UserResponse {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  country?: string | null;
  city?: string | null;
  region?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payload pour les tokens de rafraîchissement
 */
export interface RefreshTokenPayload extends JwtPayload {
  type: 'refresh';
}

/**
 * Options de génération de token
 */
export interface TokenOptions {
  expiresIn?: string;
  secret?: string;
}

/**
 * Contexte utilisateur pour les guards
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}