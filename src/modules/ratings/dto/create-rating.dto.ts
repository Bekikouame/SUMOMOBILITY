import { IsInt, Min, Max, IsString, IsOptional, IsUUID, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRatingDto {
  @ApiProperty({ example: 'ride-123', description: 'ID de la course' })
  @IsUUID()
  rideId: string;

  @ApiProperty({ example: 5, description: 'Note globale (1-5 étoiles)' })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiProperty({ 
    example: 'Excellent chauffeur, très ponctuel et voiture propre!', 
    description: 'Commentaire optionnel',
    required: false 
  })
  @IsString()
  @IsOptional()
  @Length(0, 500)
  comment?: string;

  @ApiProperty({ example: 5, description: 'Note ponctualité (1-5)', required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  punctuality?: number;

  @ApiProperty({ example: 4, description: 'Note propreté (1-5)', required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  cleanliness?: number;

  @ApiProperty({ example: 5, description: 'Note conduite (1-5)', required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  driving?: number;

  @ApiProperty({ example: 4, description: 'Note courtoisie (1-5)', required: false })
  @IsInt()
  @Min(1)
  @Max(5)
  @IsOptional()
  courtesy?: number;
}
