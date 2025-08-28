import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { TemplateService } from './services/template.service';
import { PushService } from './services/push.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    TemplateService,
    PushService,
    EmailService,
    SmsService
  ],
  exports: [NotificationsService] // Exporté pour utilisation dans autres modules
})
export class NotificationsModule {}
