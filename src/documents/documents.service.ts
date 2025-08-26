// src/documents/documents.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { ReviewDocumentDto } from './dto/review-document.dto';
import { QueryDocumentsDto } from './dto/query-documents.dto';
import { FileUploadService } from '../documents/service/file-upload.service';
import { NotificationService } from './service/notification.service';
import { DOCUMENT_TYPE_CONFIG } from './constante/document-types.constant';
import { DocumentStatus, UserRole,DriverDocument } from '@prisma/client';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private fileUploadService: FileUploadService,
    private notificationService: NotificationService
  ) {}

  // Upload d'un document
  async uploadDocument(
    file: Express.Multer.File,
    uploadDto: UploadDocumentDto,
    userId: string,
    userRole: UserRole
  ) {
    // Déterminer le driverId
    let driverId = uploadDto.driverId;
    
    if (userRole === UserRole.DRIVER) {
      // Pour un chauffeur, utiliser son propre profil
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId },
        include: { user: true }
      });
      
      if (!driver) {
        throw new NotFoundException('Profil chauffeur non trouvé');
      }
      
      driverId = driver.id;
    } else if (userRole === UserRole.ADMIN && !driverId) {
      throw new BadRequestException('ID du chauffeur requis pour admin');
    }

    // Vérifier que le driver existe
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { user: true }
    });

    if (!driver) {
      throw new NotFoundException('Chauffeur non trouvé');
    }

    // Valider le fichier
    this.fileUploadService.validateFile(file, uploadDto.docType);

    // Vérifier s'il existe déjà un document de ce type pour ce chauffeur
    const existingDoc = await this.prisma.driverDocument.findFirst({
      where: {
        driverId,
        docType: uploadDto.docType,
        status: { not: DocumentStatus.REJECTED }
      }
    });

    if (existingDoc) {
      // Supprimer l'ancien fichier et remplacer
      if (existingDoc.fileUrl) {
        await this.fileUploadService.deleteFile(existingDoc.fileUrl);
      }
    }

    // Sauvegarder le fichier
const fileUrl = await this.fileUploadService.saveFile(file, driverId!, uploadDto.docType);

// Préparer les données du document
const documentData = {
  docType: uploadDto.docType,
  docNumber: uploadDto.docNumber,
  fileUrl,
  status: DocumentStatus.PENDING,
  expiresAt: uploadDto.expiresAt ? new Date(uploadDto.expiresAt) : null,
  driver: { connect: { id: driverId! } } // Lien avec le driver existant
};

// Créer ou mettre à jour le document
let document;
if (existingDoc) {
  document = await this.prisma.driverDocument.update({
    where: { id: existingDoc.id },
    data: documentData,
    include: { driver: { include: { user: true } } }
  });
} else {
  document = await this.prisma.driverDocument.create({
    data: documentData,
    include: { driver: { include: { user: true } } }
  });
}

// Retourner le document avec config
return {
  ...document,
  config: DOCUMENT_TYPE_CONFIG[uploadDto.docType]
};
  }

  // Lister les documents d'un chauffeur
  async getDriverDocuments(driverId: string, userId: string, userRole: UserRole) {
    // Vérifier les permissions
    if (userRole === UserRole.DRIVER) {
      const driver = await this.prisma.driverProfile.findUnique({
        where: { userId }
      });

      if (!driver || driver.id !== driverId) {
        throw new ForbiddenException('Accès non autorisé à ces documents');
      }
    }

    const documents = await this.prisma.driverDocument.findMany({
      where: { driverId },
      include: {
        driver: { include: { user: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return documents.map(doc => ({
      ...doc,
      config: DOCUMENT_TYPE_CONFIG[doc.docType]
    }));
  }

  // Révision d'un document (admin)
  async reviewDocument(id: string, reviewDto: ReviewDocumentDto, adminId: string) {
    const document = await this.prisma.driverDocument.findUnique({
      where: { id },
      include: {
        driver: { include: { user: true } }
      }
    });

    if (!document) {
      throw new NotFoundException('Document non trouvé');
    }

    const updatedDocument = await this.prisma.driverDocument.update({
      where: { id },
      data: {
        status: reviewDto.status,
        reviewedBy: adminId,
        reviewedAt: new Date()
      },
      include: {
        driver: { include: { user: true } }
      }
    });

    // Envoyer notification
    await this.notificationService.sendApprovalNotification(
      document.driver.user.email,
      DOCUMENT_TYPE_CONFIG[document.docType].label,
      reviewDto.status === DocumentStatus.APPROVED
    );

    return {
      ...updatedDocument,
      config: DOCUMENT_TYPE_CONFIG[updatedDocument.docType],
      reviewComment: reviewDto.reviewComment
    };
  }

  // Documents en attente (admin)
  async getPendingDocuments(query: QueryDocumentsDto) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: any = {
      status: DocumentStatus.PENDING
    };

    if (query.docType) {
      where.docType = query.docType;
    }

    const [documents, total] = await Promise.all([
      this.prisma.driverDocument.findMany({
        where,
        include: {
          driver: { include: { user: true } }
        },
        orderBy: { createdAt: 'asc' }, // Plus anciens en premier
        skip,
        take: limit
      }),
      this.prisma.driverDocument.count({ where })
    ]);

    return {
      documents: documents.map(doc => ({
        ...doc,
        config: DOCUMENT_TYPE_CONFIG[doc.docType]
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Documents qui expirent bientôt
  async getExpiringDocuments(query: QueryDocumentsDto) {
    const days = parseInt(query.expiringInDays || '30');
    const expirationThreshold = new Date();
    expirationThreshold.setDate(expirationThreshold.getDate() + days);

    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: any = {
      status: DocumentStatus.APPROVED,
      expiresAt: {
        not: null,
        lte: expirationThreshold
      }
    };

    if (query.docType) {
      where.docType = query.docType;
    }

    const [documents, total] = await Promise.all([
      this.prisma.driverDocument.findMany({
        where,
        include: {
          driver: { include: { user: true } }
        },
        orderBy: { expiresAt: 'asc' }, // Plus urgents en premier
        skip,
        take: limit
      }),
      this.prisma.driverDocument.count({ where })
    ]);

    // Envoyer les notifications si nécessaire
    for (const doc of documents) {
      if (doc.expiresAt) {
        await this.notificationService.sendExpirationWarning(
          doc.driver.user.email,
          DOCUMENT_TYPE_CONFIG[doc.docType].label,
          doc.expiresAt
        );
      }
    }

    return {
      documents: documents.map(doc => ({
        ...doc,
        config: DOCUMENT_TYPE_CONFIG[doc.docType],
        daysUntilExpiration: doc.expiresAt 
          ? Math.ceil((doc.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Obtenir tous les documents avec filtres
  async getAllDocuments(query: QueryDocumentsDto) {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '10');
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.docType) {
      where.docType = query.docType;
    }

    const [documents, total] = await Promise.all([
      this.prisma.driverDocument.findMany({
        where,
        include: {
          driver: { include: { user: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      this.prisma.driverDocument.count({ where })
    ]);

    return {
      documents: documents.map(doc => ({
        ...doc,
        config: DOCUMENT_TYPE_CONFIG[doc.docType]
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Statistiques des documents
  async getDocumentStatistics() {
    const [byStatus, byType, expiringSoon, total] = await Promise.all([
      this.prisma.driverDocument.groupBy({
        by: ['status'],
        _count: true
      }),
      this.prisma.driverDocument.groupBy({
        by: ['docType'],
        _count: true
      }),
      this.prisma.driverDocument.count({
        where: {
          status: DocumentStatus.APPROVED,
          expiresAt: {
            not: null,
            lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
          }
        }
      }),
      this.prisma.driverDocument.count()
    ]);

    return {
      total,
      expiringSoon,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      byType: byType.reduce((acc, item) => {
        acc[item.docType] = item._count;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  // Obtenir les types de documents configurés
  getDocumentTypes() {
    return Object.entries(DOCUMENT_TYPE_CONFIG).map(([type, config]) => ({
      type,
      ...config
    }));
  }
}