// src/modules/rides/dto/create-rating.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({ description: 'Note globale', minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiProperty({ description: 'Commentaire', required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ description: 'Note ponctualité', minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  punctuality?: number;

  @ApiProperty({ description: 'Note propreté', minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  cleanliness?: number;

  @ApiProperty({ description: 'Note conduite', minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  driving?: number;

  @ApiProperty({ description: 'Note courtoisie', minimum: 1, maximum: 5, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  courtesy?: number;
}