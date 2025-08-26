// src/reservations/dto/create-reservation.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { 
  IsNotEmpty, 
  IsString, 
  IsOptional, 
  IsDateString, 
  IsNumber, 
  IsPositive,
  IsInt,
  Min,
  Max,
  MaxLength
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateReservationDto {
  @ApiProperty({ 
    example: '2024-03-15T14:30:00.000Z', 
    description: 'Date et heure programmée pour la course' 
  })
  @IsNotEmpty({ message: 'La date programmée est obligatoire' })
  @IsDateString({}, { message: 'Format de date invalide' })
  scheduledAt: string;

  @ApiProperty({ 
    example: 'Cocody Riviera, Abidjan', 
    description: 'Adresse de prise en charge',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'L\'adresse de prise en charge doit être une chaîne' })
  @MaxLength(255, { message: 'L\'adresse de prise en charge ne peut dépasser 255 caractères' })
  pickupAddress?: string;

  @ApiProperty({ 
    example: 'Aéroport Félix Houphouët-Boigny', 
    description: 'Adresse de destination',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'L\'adresse de destination doit être une chaîne' })
  @MaxLength(255, { message: 'L\'adresse de destination ne peut dépasser 255 caractères' })
  destinationAddress?: string;

  @ApiProperty({ 
    example: 15.5, 
    description: 'Distance estimée en kilomètres',
    required: false 
  })
  @IsOptional()
  @IsNumber({}, { message: 'La distance doit être un nombre' })
  @IsPositive({ message: 'La distance doit être positive' })
  estimatedDistance?: number;

  @ApiProperty({ 
    example: 2, 
    description: 'Nombre de passagers',
    default: 1 
  })
  @IsOptional()
  @IsInt({ message: 'Le nombre de passagers doit être un entier' })
  @Min(1, { message: 'Au moins 1 passager requis' })
  @Max(8, { message: 'Maximum 8 passagers autorisés' })
  @Transform(({ value }) => parseInt(value))
  passengerCount?: number = 1;

  @ApiProperty({ 
    example: 'Prévoir siège bébé, bagage volumineux', 
    description: 'Notes ou instructions spéciales',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Les notes doivent être une chaîne' })
  @MaxLength(500, { message: 'Les notes ne peuvent dépasser 500 caractères' })
  notes?: string;
}
