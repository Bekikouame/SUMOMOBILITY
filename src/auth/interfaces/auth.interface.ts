import { UserRole } from '@prisma/client';

/**
 * Payload JWT pour l'access token
 */
export interface JwtPayload {
  sub: string;
  email: string | null;
  role: UserRole;
  iat?: number;
  exp?: number;
  type?: string;
}

/**
 * Réponse complète d'authentification
 */
export interface AuthResponse {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string | null;
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
  email?: string | null;
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

export interface RefreshTokenPayload extends JwtPayload {
  type: 'refresh';
}

export interface TokenOptions {
  expiresIn?: string;
  secret?: string;
}

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  role: UserRole;
  isActive: boolean;
}