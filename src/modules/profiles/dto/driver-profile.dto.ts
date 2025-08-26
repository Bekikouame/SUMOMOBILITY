// src/modules/profiles/dto/driver-profile.dto.ts
import { IsOptional, IsString, IsEnum, IsInt, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DriverStatus } from '@prisma/client';

export class CreateDriverProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workingHours?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxRadius?: number;
}

export class UpdateDriverProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  driverType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workingHours?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  maxRadius?: number;

  @ApiPropertyOptional({ enum: DriverStatus })
  @IsOptional()
  @IsEnum(DriverStatus)
  status?: DriverStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  totalRides?: number;
}
