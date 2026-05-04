// src/email/email.service.ts

import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    // ✅ Configuration IONOS (port 465 avec secure: true)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.ionos.fr',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true, // ✅ IMPORTANT pour port 465
      auth: {
        user: process.env.SMTP_USER || 'noreply@smartex-expertises.com',
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV !== 'development',
      }
    });

    // ✅ Vérifier la connexion au démarrage
    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Serveur email prêt (IONOS)');
    } catch (error) {
      console.error('❌ Erreur connexion email:', error);
    }
  }

  async sendDriverApprovalEmail(
    email: string, 
    firstName: string, 
    lastName: string
  ) {
    const mailOptions = {
      from: `"SumoMobility" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: '🎉 Félicitations ! Votre compte chauffeur a été approuvé',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background-color: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
              color: white; 
              padding: 40px 20px; 
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content { 
              padding: 40px 30px;
              background-color: white;
            }
            .content h2 {
              color: #333;
              margin-top: 0;
            }
            .highlight { 
              background-color: #e8f5e9; 
              padding: 20px; 
              border-left: 4px solid #4CAF50; 
              margin: 25px 0;
              border-radius: 5px;
            }
            .highlight p {
              margin: 0;
              font-weight: 600;
              color: #2e7d32;
            }
            ul { 
              line-height: 2;
              padding-left: 20px;
            }
            ul li {
              margin-bottom: 10px;
            }
            .button { 
              display: inline-block; 
              padding: 15px 35px; 
              background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
              color: white !important; 
              text-decoration: none; 
              border-radius: 25px;
              font-weight: bold;
              margin: 25px 0;
              box-shadow: 0 4px 6px rgba(76, 175, 80, 0.3);
              transition: all 0.3s ease;
            }
            .button:hover {
              transform: translateY(-2px);
              box-shadow: 0 6px 12px rgba(76, 175, 80, 0.4);
            }
            .footer { 
              text-align: center; 
              padding: 20px;
              background-color: #f9f9f9;
              color: #666; 
              font-size: 12px;
              border-top: 1px solid #e0e0e0;
            }
            .logo {
              font-size: 48px;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🚗</div>
              <h1>✅ Compte Approuvé !</h1>
            </div>
            
            <div class="content">
              <h2>Bonjour ${firstName} ${lastName},</h2>
              
              <p>🎉 <strong>Excellente nouvelle !</strong></p>
              
              <div class="highlight">
                <p>Votre compte chauffeur SumoMobility a été approuvé avec succès !</p>
              </div>
              
              <p><strong>Vous pouvez désormais :</strong></p>
              <ul>
                <li>✅ Vous connecter à l'application</li>
                <li>✅ Accéder à votre espace chauffeur</li>
                <li>✅ Accepter des courses</li>
                <li>✅ Commencer à gagner de l'argent</li>
              </ul>

              <div style="text-align: center;">
                <a href="#" class="button">Se connecter maintenant</a>
              </div>

              <p>Si vous avez des questions, n'hésitez pas à nous contacter à <a href="mailto:${process.env.SMTP_FROM || process.env.SMTP_USER}" style="color: #4CAF50;">${process.env.SMTP_FROM || process.env.SMTP_USER}</a></p>
              
              <p><strong>Bonne route ! 🚗💨</strong></p>
              
              <p>Cordialement,<br><strong>L'équipe SumoMobility</strong></p>
            </div>
            
            <div class="footer">
              <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre directement.</p>
              <p>&copy; ${new Date().getFullYear()} SumoMobility. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email d\'approbation envoyé à:', email);
      console.log('📧 Message ID:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      throw error;
    }
  }

  async sendDriverRejectionEmail(
    email: string, 
    firstName: string, 
    lastName: string,
    reason?: string
  ) {
    const mailOptions = {
      from: `"SumoMobility" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Mise à jour de votre candidature chauffeur',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              line-height: 1.6; 
              color: #333;
              margin: 0;
              padding: 0;
              background-color: #f4f4f4;
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background-color: white;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }
            .header { 
              background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
              color: white; 
              padding: 40px 20px; 
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content { 
              padding: 40px 30px;
            }
            .reason-box { 
              background-color: #fff3cd; 
              padding: 20px; 
              border-left: 4px solid #f44336; 
              margin: 20px 0;
              border-radius: 5px;
            }
            .reason-box p {
              margin: 0;
            }
            ul { 
              line-height: 2;
              padding-left: 20px;
            }
            .footer { 
              text-align: center; 
              padding: 20px;
              background-color: #f9f9f9;
              color: #666; 
              font-size: 12px;
              border-top: 1px solid #e0e0e0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>❌ Candidature non approuvée</h1>
            </div>
            
            <div class="content">
              <h2>Bonjour ${firstName} ${lastName},</h2>
              
              <p>Nous avons examiné votre candidature pour devenir chauffeur sur SumoMobility.</p>
              
              <p>Malheureusement, nous ne pouvons pas approuver votre compte pour le moment.</p>
              
              ${reason ? `
                <div class="reason-box">
                  <p><strong>Raison :</strong></p>
                  <p>${reason}</p>
                </div>
              ` : ''}
              
              <p><strong>Vous pouvez soumettre une nouvelle candidature en vous assurant que :</strong></p>
              <ul>
                <li>Tous vos documents sont valides et lisibles</li>
                <li>Les informations fournies sont exactes</li>
                <li>Votre véhicule répond aux critères requis</li>
              </ul>
              
              <p>Pour toute question, contactez-nous à <a href="mailto:${process.env.SMTP_FROM || process.env.SMTP_USER}" style="color: #f44336;">${process.env.SMTP_FROM || process.env.SMTP_USER}</a></p>
              
              <p>Cordialement,<br><strong>L'équipe SumoMobility</strong></p>
            </div>
            
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} SumoMobility. Tous droits réservés.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log('✅ Email de rejet envoyé à:', email);
      console.log('📧 Message ID:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      throw error;
    }
  }

 // src/email/email.service.ts

async sendResetCode(email: string, code: string, userName?: string) {
  // ✅ Ajouter userName comme 3ème paramètre
  const mailOptions = {
    from: `"SumoMobility" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject: 'Code de réinitialisation de mot de passe',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background-color: white;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          .header { 
            background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
            color: white; 
            padding: 40px 20px; 
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .content { 
            padding: 40px 30px;
          }
          .content h2 {
            color: #333;
            margin-top: 0;
          }
          .code-box { 
            background-color: #e3f2fd; 
            padding: 30px; 
            text-align: center; 
            margin: 30px 0; 
            border-radius: 10px;
            border: 2px dashed #2196F3;
          }
          .code {
            font-size: 42px;
            font-weight: bold;
            color: #2196F3;
            letter-spacing: 8px;
            font-family: 'Courier New', monospace;
            margin: 15px 0;
          }
          .warning {
            background-color: #fff3cd;
            padding: 15px;
            border-left: 4px solid #ff9800;
            margin: 20px 0;
            border-radius: 5px;
          }
          .footer { 
            text-align: center; 
            padding: 20px;
            background-color: #f9f9f9;
            color: #666; 
            font-size: 12px;
            border-top: 1px solid #e0e0e0;
          }
          .logo {
            font-size: 48px;
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🔐</div>
            <h1>Réinitialisation de mot de passe</h1>
          </div>
          
          <div class="content">
            ${userName ? `<h2>Bonjour ${userName},</h2>` : '<h2>Bonjour,</h2>'}
            
            <p>Vous avez demandé la réinitialisation de votre mot de passe SumoMobility.</p>
            
            <div class="code-box">
              <p style="margin: 0; font-size: 14px; color: #666;">Votre code de vérification :</p>
              <div class="code">${code}</div>
              <p style="margin: 10px 0 0 0; font-size: 12px; color: #999;">
                ⏱️ Ce code expire dans <strong>15 minutes</strong>
              </p>
            </div>
            
            <div class="warning">
              <p style="margin: 0;">
                ⚠️ <strong>Important :</strong> Si vous n'avez pas demandé cette réinitialisation, 
                ignorez cet email. Votre mot de passe restera inchangé.
              </p>
            </div>

            <p style="color: #666; font-size: 14px; margin-top: 30px;">
              Pour des raisons de sécurité :
            </p>
            <ul style="color: #666; font-size: 14px;">
              <li>Ne partagez jamais ce code avec personne</li>
              <li>SumoMobility ne vous demandera jamais votre mot de passe par email</li>
              <li>Vous avez 3 tentatives maximum</li>
            </ul>
            
            <p>Cordialement,<br><strong>L'équipe SumoMobility</strong></p>
          </div>
          
          <div class="footer">
            <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre directement.</p>
            <p>&copy; ${new Date().getFullYear()} SumoMobility. Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await this.transporter.sendMail(mailOptions);
    console.log(' Code de réinitialisation envoyé à:', email);
    console.log(' Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(' Erreur envoi email:', error);
    throw error;
  }
}
}