import { IsBoolean, IsOptional, IsString, IsArray, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateUserStatusDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  @Type(() => Boolean)
  isActive: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class BulkUserActionDto {
  @ApiProperty({ example: ['user1', 'user2'] })
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @ApiProperty({ enum: ['activate', 'deactivate', 'delete'] })
  @IsIn(['activate', 'deactivate', 'delete'])
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}