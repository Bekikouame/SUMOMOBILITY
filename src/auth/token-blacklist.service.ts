import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenBlacklistService {
  // userId → timestamp (ms) avant lequel tous les tokens sont invalides
  private readonly invalidatedBefore = new Map<string, number>();

  invalidateUser(userId: string): void {
    this.invalidatedBefore.set(userId, Date.now());
  }

  isTokenValid(userId: string, issuedAt: number): boolean {
    const cutoff = this.invalidatedBefore.get(userId);
    if (!cutoff) return true;
    // iat JWT est en secondes, cutoff en ms
    return issuedAt * 1000 > cutoff;
  }
}
