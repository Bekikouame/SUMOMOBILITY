// src/documents/dto/review-document.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';

export class ReviewDocumentDto {
  @ApiProperty({ 
    description: 'Nouveau statut du document',
    enum: DocumentStatus,
    example: DocumentStatus.APPROVED
  })
  @IsEnum(DocumentStatus)
  status: DocumentStatus;

  @ApiProperty({ 
    description: 'Commentaire de révision',
    example: 'Document conforme, approuvé',
    required: false
  })
  @IsOptional()
  @IsString()
  reviewComment?: string;
}