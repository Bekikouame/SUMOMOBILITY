// src/vehicles/dto/verify-vehicle.dto.ts
import { IsBoolean, IsOptional,IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyVehicleDto {
  @ApiProperty({ description: 'Statut de vérification', example: true })
  @IsBoolean()
  verified: boolean;

  @ApiProperty({ description: 'Commentaire de vérification', required: false })
  @IsOptional()
  @IsString()
  comment?: string;
}