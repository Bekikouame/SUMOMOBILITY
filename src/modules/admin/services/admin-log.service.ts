// src/modules/admin/services/admin-log.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

interface LogData {
  action: string;
  resource: string;
  resourceId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AdminLogService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer un log admin
   */
  async log(adminId: string, data: LogData) {
    try {
      await this.prisma.adminLog.create({
        data: {
          adminId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          oldValues: data.oldValues,
          newValues: data.newValues,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
        },
      });
    } catch (error) {
      console.error('Erreur lors de la création du log admin:', error);
      // Ne pas throw pour ne pas bloquer l'action principale
    }
  }

  /**
   * ✅ NOUVELLE MÉTHODE - Récupérer les logs
   */
  async getLogs(
    adminId?: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;
    const where = adminId ? { adminId } : {};

    const [logs, total] = await Promise.all([
      this.prisma.adminLog.findMany({
        where,
        include: {
          admin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.adminLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * ✅ NOUVELLE MÉTHODE - Récupérer les logs d'un admin spécifique
   */
  async getAdminLogs(adminId: string, page: number = 1, limit: number = 50) {
    return this.getLogs(adminId, page, limit);
  }

  /**
   * ✅ NOUVELLE MÉTHODE - Récupérer tous les logs
   */
  async getAllLogs(page: number = 1, limit: number = 50) {
    return this.getLogs(undefined, page, limit);
  }

  /**
   * ✅ NOUVELLE MÉTHODE - Statistiques des logs
   */
  async getLogStatistics() {
    const [totalLogs, actionCounts] = await Promise.all([
      this.prisma.adminLog.count(),
      this.prisma.adminLog.groupBy({
        by: ['action'],
        _count: {
          action: true,
        },
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
      }),
    ]);

    return {
      totalLogs,
      actionBreakdown: actionCounts.map((item) => ({
        action: item.action,
        count: item._count.action,
      })),
    };
  }

  /**
   * ✅ NOUVELLE MÉTHODE - Rechercher dans les logs
   */
  async searchLogs(
    searchTerm: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.adminLog.findMany({
        where: {
          OR: [
            { action: { contains: searchTerm, mode: 'insensitive' } },
            { resource: { contains: searchTerm, mode: 'insensitive' } },
            { resourceId: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        include: {
          admin: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.adminLog.count({
        where: {
          OR: [
            { action: { contains: searchTerm, mode: 'insensitive' } },
            { resource: { contains: searchTerm, mode: 'insensitive' } },
            { resourceId: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}