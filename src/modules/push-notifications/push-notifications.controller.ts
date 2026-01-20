// src/modules/push-notifications/push-notifications.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PushNotificationsService } from './push-notifications.service';

@ApiTags('push-notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push-notifications')
export class PushNotificationsController {
  constructor(
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Post('register-token')
  @ApiOperation({ summary: 'Enregistrer le token push Expo' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Token push enregistré avec succès',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Token invalide',
  })
  async registerPushToken(
    @Request() req,
    @Body() body: { expoPushToken: string },
  ) {
    const userId = req.user.sub;
    await this.pushNotificationsService.registerPushToken(
      userId,
      body.expoPushToken,
    );

    return {
      message: 'Token push enregistré avec succès',
      success: true,
    };
  }
}
