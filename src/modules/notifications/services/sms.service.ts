import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  /**
   * Envoie un SMS
   * @param userId ID utilisateur
   * @param phoneNumber Numéro de téléphone
   * @param message Message
   */
  async sendSms(
    userId: string,
    phoneNumber: string,
    message: string
  ): Promise<boolean> {
    try {
      // TODO: Intégrer avec Twilio, AWS SNS, ou service local
      
      this.logger.log(`📱 SMS vers ${phoneNumber}: ${message.substring(0, 50)}...`);

      // Simuler délai réseau
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Simuler parfois des échecs (7% - SMS plus fragile)
      if (Math.random() < 0.07) {
        throw new Error('Échec temporaire du service SMS');
      }

      return true;
    } catch (error) {
      this.logger.error(`Erreur SMS: ${error.message}`);
      return false;
    }
  }
}