// src/vehicles/dto/create-vehicle-onboarding.dto.ts

import { IsString, IsNotEmpty, IsInt, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVehicleOnboardingDto {
  @ApiProperty({ example: 'CI-23-2005' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ example: 'Corolla' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 'Blanc' })
  @IsString()
  @IsNotEmpty()
  color: string;

  @ApiProperty({ example: 'STANDARD' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 2020 })
  @IsInt()
  @Min(1900)
  year: number;

  @ApiProperty({ example: 4, default: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}