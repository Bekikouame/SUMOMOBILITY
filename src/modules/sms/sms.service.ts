import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OrangeTokenResponse {
  access_token: string;
  expires_in: number;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private tokenCache: { token: string; expiresAt: number } | null = null;

  constructor(private readonly configService: ConfigService) {}

  private async getAccessToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const clientId = this.configService.get<string>('ORANGE_SMS_CLIENT_ID');
    const clientSecret = this.configService.get<string>('ORANGE_SMS_CLIENT_SECRET');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await fetch('https://api.orange.com/oauth/v3/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`Orange OAuth error: ${error}`);
      throw new Error('Impossible d\'obtenir le token Orange SMS');
    }

    const data = (await response.json()) as OrangeTokenResponse;
    this.tokenCache = {
      token: data.access_token,
      // Renouveler 60s avant expiration
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return data.access_token;
  }

  async sendSms(to: string, message: string): Promise<boolean> {
    const senderAddress = this.configService.get<string>('ORANGE_SMS_SENDER_ADDRESS');

    try {
      const token = await this.getAccessToken();

      // 371484 est un short code → format "tel:+371484" dans l'URL
      const senderUri    = `tel:${senderAddress}`;
      const encodedSender = encodeURIComponent(senderUri);

      const response = await fetch(
        `https://api.orange.com/smsmessaging/v1/outbound/${encodedSender}/requests`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            outboundSMSMessageRequest: {
              address:       `tel:${to}`,
              senderAddress: senderUri,
              outboundSMSTextMessage: { message },
            },
          }),
        },
      );

      if (!response.ok) {
        // Token expiré côté serveur → vider le cache et réessayer une fois
        if (response.status === 401) {
          this.tokenCache = null;
          return this.sendSms(to, message);
        }
        const errorBody = await response.text();
        this.logger.error(`Orange SMS error ${response.status}: ${errorBody}`);
        return false;
      }

      this.logger.log(`SMS OTP envoyé à ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Erreur envoi SMS à ${to}: ${error.message}`);
      return false;
    }
  }

  buildOtpMessage(code: string): string {
    return `Votre code SumoMobility est : ${code}. Valable 5 minutes. Ne le partagez pas.`;
  }
}
