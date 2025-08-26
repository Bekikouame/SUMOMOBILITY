//  Service d'email personnalisé (optionnel)
// src/documents/services/email.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailService {
  async sendDocumentExpirationWarning(email: string, documentType: string, expiresAt: Date) {
    // Intégration avec votre service email (SendGrid, Nodemailer, etc.)
    console.log(`📧 Email envoyé à ${email}: Document ${documentType} expire le ${expiresAt.toDateString()}`);
    
    // Exemple avec Nodemailer:
    // const transporter = nodemailer.createTransporter({...});
    // await transporter.sendMail({
    //   to: email,
    //   subject: ` Document ${documentType} expire bientôt`,
    //   html: `Votre document ${documentType} expire le ${expiresAt.toDateString()}`
    // });
  }

  async sendDocumentStatusUpdate(email: string, documentType: string, status: string) {
    console.log(`📧 Email envoyé à ${email}: Document ${documentType} ${status}`);
  }
}
