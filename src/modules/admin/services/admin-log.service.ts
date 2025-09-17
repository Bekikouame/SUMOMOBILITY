// src/admin/services/admin-log.service.ts
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

  async log(adminId: string, data: LogData) {
    return this.prisma.adminLog.create({
      data: {
        adminId,
        ...data,
      },
    });
  }

  async getLogs(
    page: number = 1,
    limit: number = 50,
    adminId?: string,
    action?: string,
    resource?: string,
  ) {
    const skip = (page - 1) * limit;
    
    const where = {
      ...(adminId && { adminId }),
      ...(action && { action }),
      ...(resource && { resource }),
    };

    const [logs, total] = await Promise.all([
      this.prisma.adminLog.findMany({
        where,
        include: {
          admin: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminLog.count({ where }),
    ]);

    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
