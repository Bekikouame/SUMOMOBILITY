import { IsEmail, IsString, MinLength, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

export class RegisterDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: '+2250123456789' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ enum: UserRole, default: UserRole.CLIENT })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.CLIENT;

  @ApiProperty({ example: 'Ivory Coast', required: false })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiProperty({ example: 'Abidjan', required: false })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({ example: 'Lagunes', required: false })
  @IsString()
  @IsOptional()
  region?: string;
}