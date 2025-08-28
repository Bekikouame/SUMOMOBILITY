// src/payments/dto/payment-filter.dto.ts
import { IsEnum, IsOptional, IsUUID, IsDateString } from 'class-validator';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from '../dto/pagination.dto';

export class PaymentFilterDto extends PaginationDto {
  @ApiProperty({ enum: PaymentMethod, description: 'Filtrer par méthode de paiement', required: false })
  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus, description: 'Filtrer par statut', required: false })
  @IsEnum(PaymentStatus)
  @IsOptional()
  status?: PaymentStatus;

  @ApiProperty({ example: '2024-01-01', description: 'Date de début (ISO)', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2024-12-31', description: 'Date de fin (ISO)', required: false })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 'driver-123', description: 'ID du chauffeur', required: false })
  @IsUUID()
  @IsOptional()
  driverId?: string;
}
