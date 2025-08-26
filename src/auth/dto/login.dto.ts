// src/modules/auth/dto/login.dto.ts


import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class LoginDto {
  @ApiProperty({ 
    example: 'john.doe@example.com', 
    description: 'Email ou numéro de téléphone',
    examples: {
      email: {
        summary: 'Connexion par email',
        value: 'john.doe@example.com'
      },
      phone: {
        summary: 'Connexion par téléphone',
        value: '+225123456789'
      }
    }
  })
  @IsString({ message: 'L\'identifiant doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'L\'identifiant (email ou téléphone) est requis' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  identifier: string;

  @ApiProperty({ 
    example: 'Password123!', 
    description: 'Mot de passe de l\'utilisateur'
  })
  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  password: string;
}
