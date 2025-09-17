// / src/admin/dto/dashboard-filter.dto.ts
import { IsOptional, IsDateString, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class DashboardFilterDto {
  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: ['CI', 'FR', 'SN'] })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ enum: ['Abidjan', 'Paris', 'Dakar'] })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: ['day', 'week', 'month', 'year'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month', 'year'])
  period?: string;
}
