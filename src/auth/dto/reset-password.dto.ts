import { IsString, MinLength, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ 
    example: '123456', 
    description: 'Code de réinitialisation reçu par email'
  })
  @IsString()
  @Length(6, 6, { message: 'Le code de réinitialisation doit contenir exactement 6 caractères' })
  code: string;

  @ApiProperty({ 
    example: 'NewPassword123!', 
    description: 'Nouveau mot de passe sécurisé'
  })
  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Le nouveau mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'
  })
  newPassword: string;
}