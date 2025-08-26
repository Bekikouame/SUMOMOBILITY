//  Middleware de validation de fichiers
// src/documents/middleware/file-validation.middleware.ts
import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class FileValidationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.route?.path === '/documents' && req.method === 'POST') {
      if (!req.file) {
        throw new BadRequestException('Fichier requis');
      }
      
      // Validation additionnelle si nécessaire
      const allowedMimeTypes = [
        'image/jpeg',
        'image/png', 
        'application/pdf'
      ];
      
      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        throw new BadRequestException('Type de fichier non autorisé');
      }
    }
    
    next();
  }
}