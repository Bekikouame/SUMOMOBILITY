// 11. Tâche CRON pour vérifier les expirations (code a evolué)
// npm install @nestjs/schedule
// src/documents/tasks/document-expiration.task.ts
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DocumentsService } from '../documents.service';

@Injectable()
export class DocumentExpirationTask {
  constructor(private documentsService: DocumentsService) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkExpiringDocuments() {
    console.log('🔍 Vérification des documents expirant dans les 30 jours...');
    
    // Vérifier les documents expirant dans 30, 7 et 1 jours
    const periods = [30, 7, 1];
    
    for (const days of periods) {
      const result = await this.documentsService.getExpiringDocuments({
        expiringInDays: days.toString(),
        limit: '100'
      });
      
      console.log(` ${result.documents.length} documents expirent dans ${days} jours`);
    }
  }
}
