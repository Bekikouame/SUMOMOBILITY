

// src/modules/profiles/dto/driver-profile.dto.ts
import { IsOptional, IsString, IsEnum, IsInt, IsNumber, Min, Max, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverStatus,PaymentMethod } from '@prisma/client';

export class CreateClientProfileDto {
  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultPickupAddress?: string;

  
}

export class UpdateClientProfileDto {
  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  preferredPaymentMethod?: PaymentMethod;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultPickupAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  loyaltyPoints?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  vipStatus?: boolean;

}