// src/admin/services/dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DashboardFilterDto } from '../dto/dashboard-filter.dto';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getOverviewStats(filters: DashboardFilterDto) {
    const { dateFrom, dateTo, country, city } = filters;
    
    const whereClause = {
      ...(dateFrom && dateTo && {
        createdAt: {
          gte: new Date(dateFrom),
          lte: new Date(dateTo),
        },
      }),
      ...(country && { country }),
      ...(city && { city }),
    };

    // Statistiques globales
    const [
      totalUsers,
      activeUsers,
      totalDrivers,
      approvedDrivers,
      totalRides,
      completedRides,
      totalRevenue,
      avgRating
    ] = await Promise.all([
      // Utilisateurs
      this.prisma.user.count({
        where: whereClause,
      }),
      this.prisma.user.count({
        where: { ...whereClause, isActive: true },
      }),
      
      // Chauffeurs
      this.prisma.driverProfile.count({
        where: {
          user: whereClause,
        },
      }),
      this.prisma.driverProfile.count({
        where: {
          status: 'APPROVED',
          user: whereClause,
        },
      }),
      
      // Courses
      this.prisma.ride.count({
        where: {
          ...(dateFrom && dateTo && {
            createdAt: {
              gte: new Date(dateFrom),
              lte: new Date(dateTo),
            },
          }),
        },
      }),
      this.prisma.ride.count({
        where: {
          status: 'COMPLETED',
          ...(dateFrom && dateTo && {
            completedAt: {
              gte: new Date(dateFrom),
              lte: new Date(dateTo),
            },
          }),
        },
      }),
      
      // Revenus
      this.prisma.ride.aggregate({
        where: {
          status: 'COMPLETED',
          ...(dateFrom && dateTo && {
            completedAt: {
              gte: new Date(dateFrom),
              lte: new Date(dateTo),
            },
          }),
        },
        _sum: { totalFare: true },
      }),
      
      // Note moyenne
      this.prisma.rating.aggregate({
        where: {
          ...(dateFrom && dateTo && {
            createdAt: {
              gte: new Date(dateFrom),
              lte: new Date(dateTo),
            },
          }),
        },
        _avg: { score: true },
      }),
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactiveRate: totalUsers > 0 ? ((totalUsers - activeUsers) / totalUsers * 100).toFixed(1) : 0,
      },
      drivers: {
        total: totalDrivers,
        approved: approvedDrivers,
        approvalRate: totalDrivers > 0 ? (approvedDrivers / totalDrivers * 100).toFixed(1) : 0,
      },
      rides: {
        total: totalRides,
        completed: completedRides,
        completionRate: totalRides > 0 ? (completedRides / totalRides * 100).toFixed(1) : 0,
      },
      revenue: {
        total: totalRevenue._sum.totalFare || 0,
        avgRating: avgRating._avg.score ? parseFloat(avgRating._avg.score.toFixed(2)) : 0,
      },
    };
  }

  async getRidesChartData(filters: DashboardFilterDto) {
    const { dateFrom, dateTo, period = 'day' } = filters;
    
    // Configuration du groupement selon la période
    const dateFormat = {
      day: '%Y-%m-%d',
      week: '%Y-%u',
      month: '%Y-%m',
      year: '%Y'
    }[period];

    const rides = await this.prisma.$queryRaw`
      SELECT 
        DATE_FORMAT(created_at, ${dateFormat}) as period,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'CANCELED' THEN 1 ELSE 0 END) as canceled
      FROM rides 
      WHERE created_at BETWEEN ${new Date(dateFrom || '2024-01-01')} AND ${new Date(dateTo || new Date())}
      GROUP BY period
      ORDER BY period
    `;

    return rides;
  }

  async getTopDrivers(limit: number = 10) {
    return this.prisma.driverProfile.findMany({
      select: {
        id: true,
        user: {
          select: { firstName: true, lastName: true, phone: true },
        },
        rating: true,
        totalRides: true,
        totalEarnings: true,
      },
      orderBy: [
        { rating: 'desc' },
        { totalRides: 'desc' },
      ],
      take: limit,
    });
  }

  async getRecentActivity(limit: number = 20) {
    return this.prisma.adminLog.findMany({
      include: {
        admin: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getGeographicStats() {
    const stats = await this.prisma.$queryRaw`
      SELECT 
        country,
        city,
        COUNT(DISTINCT u.id) as users_count,
        COUNT(DISTINCT dp.id) as drivers_count,
        COUNT(DISTINCT r.id) as rides_count
      FROM users u
      LEFT JOIN driver_profiles dp ON dp.user_id = u.id
      LEFT JOIN rides r ON r.client_id = u.id OR r.driver_id = dp.id
      WHERE u.country IS NOT NULL AND u.city IS NOT NULL
      GROUP BY country, city
      ORDER BY users_count DESC
    `;

    return stats;
  }
}
