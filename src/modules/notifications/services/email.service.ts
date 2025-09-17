import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  /**
   * Envoie un email
   * @param userId ID utilisateur
   * @param userEmail Email destinataire
   * @param subject Sujet
   * @param body Corps du message
   */
  async sendEmail(
    userId: string,
    userEmail: string,
    subject: string,
    body: string
  ): Promise<boolean> {
    try {
      // TODO: Intégrer avec SendGrid, Mailgun, ou AWS SES
      
      this.logger.log(` EMAIL vers ${userEmail}: ${subject}`);
      this.logger.debug(`Corps: ${body.substring(0, 100)}...`);

      // Simuler délai réseau
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Simuler parfois des échecs (3%)
      if (Math.random() < 0.03) {
        throw new Error('Échec temporaire du service email');
      }

      return true;
    } catch (error) {
      this.logger.error(`Erreur email: ${error.message}`);
      return false;
    }
  }
}
