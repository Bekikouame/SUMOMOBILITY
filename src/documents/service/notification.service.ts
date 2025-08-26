// src/documents/services/notification.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class NotificationService {
  async sendExpirationWarning(driverEmail: string, documentType: string, expiresAt: Date) {
    // TODO: Implémenter l'envoi d'email/SMS
    console.log(` NOTIFICATION: ${driverEmail} - Document ${documentType} expire le ${expiresAt.toDateString()}`);
    
    // Exemple d'intégration future:
    // await this.emailService.send({
    //   to: driverEmail,
    //   template: 'document-expiration',
    //   context: { documentType, expiresAt }
    // });
  }

  async sendApprovalNotification(driverEmail: string, documentType: string, approved: boolean) {
    const status = approved ? 'approuvé' : 'rejeté';
    console.log(`NOTIFICATION: ${driverEmail} - Document ${documentType} ${status}`);
  }
}
