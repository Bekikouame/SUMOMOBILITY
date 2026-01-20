// src/modules/drivers/drivers.module.ts

import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { DriversAppController } from './driver-app.controller';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [DriversController, DriversAppController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}