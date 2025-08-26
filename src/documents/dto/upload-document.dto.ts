// src/documents/dto/upload-document.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentType } from '../constante/document-types.constant';

export class UploadDocumentDto {
  @ApiProperty({ 
    description: 'Type de document',
    enum: DocumentType,
    example: DocumentType.DRIVING_LICENSE
  })
  @IsEnum(DocumentType)
  docType: DocumentType;

  @ApiProperty({ 
    description: 'Numéro du document',
    example: 'DL123456789',
    required: false
  })
  @IsOptional()
  @IsString()
  docNumber?: string;

  @ApiProperty({ 
    description: 'Date d\'expiration (ISO format)',
    example: '2025-12-31T23:59:59.000Z',
    required: false
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiProperty({ 
    description: 'ID du chauffeur (optionnel, déduit du token si DRIVER)',
    required: false
  })
  @IsOptional()
  @IsString()
  driverId?: string;
}