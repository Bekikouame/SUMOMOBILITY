import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { NotificationType, NotificationChannel } from '@prisma/client';

@Injectable()
export class TemplateService {
  constructor(private prisma: PrismaService) {}

  /**
   * Récupère un template par type et canal
   * @param type Type de notification
   * @param channel Canal de notification
   * @param language Langue (défaut: fr)
   * @returns Template trouvé
   */
  async getTemplate(
    type: NotificationType,
    channel: NotificationChannel,
    language: string = 'fr'
  ) {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: {
        type_channel_language: {
          type,
          channel,
          language
        }
      }
    });

    if (!template) {
      throw new NotFoundException(
        `Template non trouvé pour type=${type}, channel=${channel}, language=${language}`
      );
    }

    return template;
  }

  /**
   * Remplace les variables dans le contenu du template
   * @param content Contenu avec variables {{variable}}
   * @param variables Variables à remplacer
   * @returns Contenu avec variables remplacées
   */
  replaceVariables(content: string, variables: Record<string, any> = {}): string {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key]?.toString() || match;
    });
  }

  /**
   * Génère le contenu final à partir d'un template
   * @param template Template à utiliser
   * @param variables Variables pour remplacement
   * @returns Contenu final
   */
  generateContent(
    template: any,
    variables: Record<string, any> = {}
  ) {
    return {
      title: this.replaceVariables(template.title, variables),
      body: this.replaceVariables(template.body, variables),
      subject: template.subject ? this.replaceVariables(template.subject, variables) : undefined
    };
  }
}