// src/documents/dto/query-documents.dto.ts
import { IsOptional, IsEnum, IsNumberString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';
import { DocumentType } from '../constante/document-types.constant';

export class QueryDocumentsDto {
  @ApiProperty({ required: false, enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiProperty({ required: false, enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  docType?: DocumentType;

  @ApiProperty({ required: false, description: 'Nombre de jours avant expiration', example: '30' })
  @IsOptional()
  @IsNumberString()
  expiringInDays?: string;

  @ApiProperty({ required: false, description: 'Page', example: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiProperty({ required: false, description: 'Éléments par page', example: '10' })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}