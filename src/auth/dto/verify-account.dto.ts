import { IsEmail, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class VerifyAccountDto {
  @ApiProperty({ 
    example: 'john.doe@example.com', 
    description: 'Adresse email du compte à vérifier'
  })
  @IsEmail({}, { message: 'Format d\'email invalide' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;

  @ApiProperty({ 
    example: '123456', 
    description: 'Code de vérification à 6 chiffres'
  })
  @IsString()
  @Length(6, 6, { message: 'Le code de vérification doit contenir exactement 6 caractères' })
  code: string;
}