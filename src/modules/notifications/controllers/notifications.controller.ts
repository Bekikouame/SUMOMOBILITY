import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { NotificationsService } from '../services/notifications.service';
import { CreateNotificationDto, NotificationFiltersDto } from '../dto/rcreate-notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ 
    summary: 'Envoyer une notification',
    description: 'Envoie une notification à un utilisateur (Admin uniquement)'
  })
  @ApiResponse({ status: 201, description: 'Notification envoyée avec succès' })
  async sendNotification(@Body() createNotificationDto: CreateNotificationDto) {
    await this.notificationsService.sendNotification({
      type: createNotificationDto.type,
      userId: createNotificationDto.userId,
      channels: createNotificationDto.channels,
      variables: createNotificationDto.variables,
      metadata: createNotificationDto.metadata,
      priority: createNotificationDto.priority,
      scheduleAt: createNotificationDto.scheduleAt ? new Date(createNotificationDto.scheduleAt) : undefined
    });

    return {
      success: true,
      message: 'Notification envoyée avec succès'
    };
  }


  @Get('me')
@ApiOperation({ 
  summary: 'Mes notifications',
  description: 'Récupère les notifications de l\'utilisateur connecté'
})
@ApiQuery({ name: 'status', required: false, description: 'Filtrer par statut' })
@ApiQuery({ name: 'type', required: false, description: 'Filtrer par type' })
@ApiQuery({ name: 'limit', required: false, description: 'Nombre max de résultats' })
async getMyNotifications(
  @Req() req: any,
  @Query() filters: NotificationFiltersDto
) {
  //  Conversion string -> Date
  const parsedFilters = {
    ...filters,
    dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
    dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined,
  };

  const notifications = await this.notificationsService.getNotifications(
    req.user.id,
    parsedFilters
  );

  return {
    success: true,
    data: notifications,
    meta: {
      count: notifications.length,
      filters: parsedFilters
    }
  };
}


  

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Marquer comme lu',
    description: 'Marque une notification comme lue'
  })
  async markAsRead(
    @Param('id') notificationId: string,
    @Req() req: any
  ) {
    await this.notificationsService.markAsRead(notificationId, req.user.id);

    return {
      success: true,
      message: 'Notification marquée comme lue'
    };
  }

  @Post('retry-failed')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: 'Relancer notifications échouées',
    description: 'Relance les notifications en échec (Admin uniquement)'
  })
  async retryFailedNotifications() {
    await this.notificationsService.retryFailedNotifications();

    return {
      success: true,
      message: 'Notifications en échec relancées'
    };
  }
}
