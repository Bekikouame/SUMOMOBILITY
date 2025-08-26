// src/documents/entities/document.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { DocumentType } from '../constante/document-types.constant';

export class DocumentEntity {
  @ApiProperty({ description: 'ID unique du document' })
  id: string;

  @ApiProperty({ description: 'Type de document', enum: DocumentType })
  docType: DocumentType;

  @ApiProperty({ description: 'Numéro du document', required: false })
  docNumber?: string;

  @ApiProperty({ description: 'URL du fichier' })
  fileUrl: string;

  @ApiProperty({ description: 'Statut du document', enum: DocumentStatus })
  status: DocumentStatus;

  @ApiProperty({ description: 'Date d\'expiration', required: false })
  expiresAt?: Date;

  @ApiProperty({ description: 'ID de l\'admin qui a validé', required: false })
  reviewedBy?: string;

  @ApiProperty({ description: 'Date de révision', required: false })
  reviewedAt?: Date;

  @ApiProperty({ description: 'ID du chauffeur propriétaire' })
  driverId: string;

  @ApiProperty({ description: 'Date de création' })
  createdAt: Date;

  @ApiProperty({ description: 'Date de dernière modification' })
  updatedAt: Date;
}