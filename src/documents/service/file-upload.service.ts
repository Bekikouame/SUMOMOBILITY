// src/documents/services/file-upload.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { DOCUMENT_TYPE_CONFIG, DocumentType } from '../constante/document-types.constant';

@Injectable()
export class FileUploadService {
  private readonly uploadDir = 'uploads/documents';

  constructor() {
    this.ensureUploadDirExists();
  }

  private async ensureUploadDirExists() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  validateFile(file: Express.Multer.File, docType: DocumentType) {
    const config = DOCUMENT_TYPE_CONFIG[docType];
    
    // Vérifier le type MIME
    if (!config.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Type de fichier non autorisé pour ${config.label}. Types acceptés: ${config.allowedTypes.join(', ')}`
      );
    }

    // Vérifier la taille
    const maxSizeBytes = config.maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      throw new BadRequestException(
        `Fichier trop volumineux. Taille maximum: ${config.maxSizeMB}MB`
      );
    }
  }

  async saveFile(file: Express.Multer.File, driverId: string, docType: DocumentType): Promise<string> {
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `${driverId}_${docType}_${timestamp}${extension}`;
    const filepath = path.join(this.uploadDir, filename);

    await fs.writeFile(filepath, file.buffer);
    
    // Retourner l'URL relative
    return `/uploads/documents/${filename}`;
  }

  async deleteFile(fileUrl: string) {
    try {
      const filename = path.basename(fileUrl);
      const filepath = path.join(this.uploadDir, filename);
      await fs.unlink(filepath);
    } catch (error) {
      console.warn('Erreur lors de la suppression du fichier:', error);
    }
  }
}