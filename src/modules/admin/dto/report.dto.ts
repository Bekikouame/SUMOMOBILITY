import { IsString, IsOptional, IsDateString, IsIn, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateReportDto {
  @ApiProperty({ enum: ['RIDES_SUMMARY', 'REVENUE_REPORT', 'USER_ANALYTICS', 'DRIVER_PERFORMANCE'] })
  @IsIn(['RIDES_SUMMARY', 'REVENUE_REPORT', 'USER_ANALYTICS', 'DRIVER_PERFORMANCE'])
  type: string;

  @ApiProperty({ example: 'Rapport mensuel janvier 2024' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  filters?: any;

  @ApiPropertyOptional({ enum: ['json', 'pdf', 'excel'] })
  @IsOptional()
  @IsIn(['json', 'pdf', 'excel'])
  format?: string = 'json';
}