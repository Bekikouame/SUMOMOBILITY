// src/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { FileUploadService } from '../documents/service/file-upload.service';
import { NotificationService } from '../documents/service/notification.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({
      dest: './uploads/documents',
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
    }),
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, FileUploadService, NotificationService],
  exports: [DocumentsService]
})
export class DocumentsModule {}
