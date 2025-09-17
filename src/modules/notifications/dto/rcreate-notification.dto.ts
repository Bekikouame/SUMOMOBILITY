// /src/notifications/dto/create-notification.dto.ts
import { 
  IsEnum, 
  IsString, 
  IsOptional, 
  IsObject, 
  IsNumber, 
  IsDateString 
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { NotificationType, NotificationChannel, NotificationStatus } from '@prisma/client'; // ✅ import corrigé

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType, description: 'Type de notification' })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'ID de l\'utilisateur destinataire' })
  @IsString()
  userId: string;

  @ApiProperty({ 
    enum: NotificationChannel, 
    isArray: true, 
    required: false,
    description: 'Canaux de notification (par défaut: selon préférences utilisateur)' 
  })
  @IsOptional()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiProperty({ 
    type: Object, 
    required: false,
    description: 'Variables pour le template (ex: {driverName: "John", destination: "Cocody"})' 
  })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @ApiProperty({ 
    type: Object, 
    required: false,
    description: 'Métadonnées contextuelles (ex: {rideId: "123", documentId: "456"})' 
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ 
    minimum: 1, 
    maximum: 3, 
    required: false, 
    default: 1,
    description: 'Priorité (1=haute, 2=moyenne, 3=basse)' 
  })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value) : value)) // ✅ sécurité ajoutée
  priority?: number;

  @ApiProperty({ 
    required: false,
    description: 'Programmer la notification pour plus tard (ISO date)' 
  })
  @IsOptional()
  @IsDateString()
  scheduleAt?: string;
}

export class NotificationFiltersDto {
  @ApiProperty({ enum: NotificationStatus, required: false })
  @IsOptional()
  @IsEnum(NotificationStatus)
  status?: NotificationStatus;

  @ApiProperty({ enum: NotificationType, required: false })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiProperty({ enum: NotificationChannel, required: false })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({ minimum: 1, maximum: 100, required: false, default: 20 })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value) : value)) //  sécurité ajoutée
  limit?: number = 20;

  @ApiProperty({ minimum: 0, required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => (typeof value === 'string' ? parseInt(value) : value)) // sécurité ajoutée
  offset?: number = 0;
}
