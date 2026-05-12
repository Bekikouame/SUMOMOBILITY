import { IsString, IsEnum, IsOptional, Matches, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class VerifyOtpDto {
  @ApiProperty({ example: '+2250123456789' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, { message: 'Numéro de téléphone invalide (format: +2250123456789)' })
  phone: string;

  @ApiProperty({ example: '123456', description: 'Code OTP à 6 chiffres' })
  @IsString()
  @Length(6, 6, { message: 'Le code OTP doit contenir exactement 6 chiffres' })
  @Matches(/^\d{6}$/, { message: 'Le code OTP doit être composé uniquement de chiffres' })
  code: string;

  @ApiProperty({ example: 'John', required: false, description: 'Requis pour la création d\'un nouveau compte' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ example: 'Doe', required: false, description: 'Requis pour la création d\'un nouveau compte' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ enum: UserRole, default: UserRole.CLIENT, required: false })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.CLIENT;

  @ApiProperty({ example: 'Côte d\'Ivoire', required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ example: 'Abidjan', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'Cocody', required: false })
  @IsString()
  @IsOptional()
  region?: string;
}
