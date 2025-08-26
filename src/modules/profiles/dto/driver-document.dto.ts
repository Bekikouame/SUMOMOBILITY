import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatus } from '@prisma/client';

export class CreateDriverDocumentDto {
  @ApiProperty()
  @IsString()
  docType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  docNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class UpdateDriverDocumentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  docNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
