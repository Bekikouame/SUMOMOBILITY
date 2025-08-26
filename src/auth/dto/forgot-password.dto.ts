import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class ForgotPasswordDto {
  @ApiProperty({ 
    example: 'john.doe@example.com', 
    description: 'Adresse email du compte à réinitialiser'
  })
  @IsEmail({}, { message: 'Format d\'email invalide' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  email: string;
}