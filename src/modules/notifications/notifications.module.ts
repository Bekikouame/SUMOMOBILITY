import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/prisma/prisma.module';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationsService } from './services/notifications.service';
import { TemplateService } from './services/template.service';
import { PushService } from './services/push.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { NotificationsGateway } from './notifications.gateway';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter/dist/event-emitter.module';

@Module({
  imports: [
    PrismaModule,
    EventEmitterModule.forRoot(),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    TemplateService,
    PushService,
    EmailService,
    SmsService
  ],
  exports: [NotificationsService, NotificationsGateway] // Exporté pour utilisation dans autres modules
})
export class NotificationsModule {}
