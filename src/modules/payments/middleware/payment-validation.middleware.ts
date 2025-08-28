// src/payments/middleware/payment-validation.middleware.ts
import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class PaymentValidationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'POST' && req.path.includes('/payments')) {
      const { amount, method } = req.body;

      // Validation montant
      if (amount !== undefined) {
        if (amount < 0) {
          throw new BadRequestException('Le montant ne peut pas être négatif');
        }
        if (amount > 1000000) { // 1M FCFA max
          throw new BadRequestException('Montant trop élevé (max: 1,000,000 FCFA)');
        }
      }

      // Validation méthode selon le contexte géographique
      if (method === 'MOBILE_MONEY' && !req.body.phone) {
        throw new BadRequestException('Numéro de téléphone requis pour Mobile Money');
      }
    }

    next();
  }
}
