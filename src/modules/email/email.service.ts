import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      }
    });
  }

  async sendResetCode(email: string, code: string, userName: string) {
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: 'Code réinitialisation - VTC Pro',
      text: `Bonjour ${userName}, votre code : ${code} (expire dans 15 min)`,
      html: `
        <h2>VTC Pro</h2>
        <p>Bonjour <strong>${userName}</strong>,</p>
        <p>Votre code : <strong style="font-size: 24px;">${code}</strong></p>
        <p><small>Expire dans 15 minutes</small></p>
      `
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email envoyé:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Erreur envoi email:', error);
      throw new Error('Erreur lors de l\'envoi de l\'email');
    }

    return await this.transporter.sendMail(mailOptions);
  }
}
