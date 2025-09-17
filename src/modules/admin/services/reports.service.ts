import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { GenerateReportDto } from '../dto/report.dto';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async generateReport(dto: GenerateReportDto, adminId: string) {
    let data;

    switch (dto.type) {
      case 'RIDES_SUMMARY':
        data = await this.generateRidesSummary(dto);
        break;
      case 'REVENUE_REPORT':
        data = await this.generateRevenueReport(dto);
        break;
      case 'USER_ANALYTICS':
        data = await this.generateUserAnalytics(dto);
        break;
      case 'DRIVER_PERFORMANCE':
        data = await this.generateDriverPerformance(dto);
        break;
      default:
        throw new BadRequestException('Type de rapport non supporté');
    }

    return this.prisma.report.create({
      data: {
        title: dto.title,
        type: dto.type,
        filters: dto.filters,
        dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : null,
        dateTo: dto.dateTo ? new Date(dto.dateTo) : null,
        data,
        generatedBy: adminId,
      },
    });
  }

  private async generateRidesSummary(dto: GenerateReportDto) {
    const dateFilter = this.getDateFilter(dto);

    const whereClause = dateFilter ? { createdAt: dateFilter } : {};

    const summary = await this.prisma.ride.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { _all: true },
      _sum: { totalFare: true, durationMinutes: true },
      _avg: { distanceKm: true },
    });

    return {
      summary,
      generatedAt: new Date(),
    };
  }

  private async generateRevenueReport(dto: GenerateReportDto) {
    const dateFilter = this.getDateFilter(dto);

    const whereClause = {
      status: 'SUCCEEDED' as const,
      ...(dateFilter && { createdAt: dateFilter }),
    };

    const revenue = await this.prisma.payment.aggregate({
      where: whereClause,
      _sum: { amount: true, processorFee: true, netAmount: true },
      _count: { _all: true },
    });

    const revenueByMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where: whereClause,
      _sum: { amount: true },
      _count: { _all: true },
    });

    return {
      total: revenue,
      byMethod: revenueByMethod,
      generatedAt: new Date(),
    };
  }

  private async generateUserAnalytics(dto: GenerateReportDto) {
    const dateFilter = this.getDateFilter(dto);

    const whereClause = dateFilter ? { createdAt: dateFilter } : {};

    const userStats = await this.prisma.user.groupBy({
      by: ['role', 'country'],
      where: whereClause,
      _count: { _all: true },
    });

    const activeUsers = await this.prisma.user.count({
      where: {
        isActive: true,
        ...(dateFilter && { lastLoginAt: dateFilter }),
      },
    });

    return {
      userStats,
      activeUsers,
      generatedAt: new Date(),
    };
  }

  private async generateDriverPerformance(dto: GenerateReportDto) {
    const dateFilter = this.getDateFilter(dto);

    let whereClause = {};
    if (dateFilter) {
      whereClause = {
        createdAt: dateFilter,
      };
    }

    const topDrivers = await this.prisma.driverProfile.findMany({
      where: whereClause,
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
        rating: true,
        totalRides: true,
        totalEarnings: true,
      },
      orderBy: [
        { totalEarnings: 'desc' },
        { rating: 'desc' },
      ],
      take: 50,
    });

    return {
      topDrivers,
      generatedAt: new Date(),
    };
  }

  private getDateFilter(dto: GenerateReportDto) {
    if (!dto.dateFrom || !dto.dateTo) return undefined;
    
    return {
      gte: new Date(dto.dateFrom),
      lte: new Date(dto.dateTo),
    };
  }

  async getReports(adminId?: string, type?: string) {
    return this.prisma.report.findMany({
      where: {
        ...(adminId && { generatedBy: adminId }),
        ...(type && { type }),
      },
      include: {
        generator: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReport(id: string) {
    return this.prisma.report.findUnique({
      where: { id },
      include: {
        generator: {
          select: { firstName: true, lastName: true },
        },
      },
    });
  }
}