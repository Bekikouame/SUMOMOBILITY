import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app!: admin.app.App;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (admin.apps.length > 0) {
      this.app = admin.apps[0]!;
      return;
    }

    const projectId    = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail  = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey   = this.configService
      .get<string>('FIREBASE_PRIVATE_KEY')
      ?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase Admin non configuré — variables FIREBASE_* manquantes');
      return;
    }

    this.app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log('Firebase Admin initialisé ✓');
  }

  async sendToToken(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<boolean> {
    if (!this.app) return false;
    try {
      await admin.messaging(this.app).send({
        token,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: 'high',
          notification: { sound: 'default', channelId: 'default' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      });
      return true;
    } catch (error: any) {
      this.logger.error(`FCM sendToToken error: ${error.message}`);
      return false;
    }
  }

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.app || tokens.length === 0) {
      return { successCount: 0, failureCount: tokens.length };
    }

    let successCount = 0;
    let failureCount = 0;

    // FCM autorise max 500 tokens par multicast
    const chunks = this.chunk(tokens, 500);
    for (const chunk of chunks) {
      try {
        const res = await admin.messaging(this.app).sendEachForMulticast({
          tokens: chunk,
          notification: { title, body },
          data: data ?? {},
          android: {
            priority: 'high',
            notification: { sound: 'default', channelId: 'default' },
          },
          apns: {
            payload: { aps: { sound: 'default', badge: 1 } },
          },
        });
        successCount += res.successCount;
        failureCount += res.failureCount;
      } catch (error: any) {
        this.logger.error(`FCM multicast error: ${error.message}`);
        failureCount += chunk.length;
      }
    }

    this.logger.log(`FCM multicast: ${successCount} succès, ${failureCount} échecs`);
    return { successCount, failureCount };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  }
}
