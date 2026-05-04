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
    const { dateFrom, dateTo, period = 'month' } = filters;

    const dateFormat = {
      day: 'YYYY-MM-DD',
      week: 'IYYY-IW',
      month: 'YYYY-MM',
      year: 'YYYY',
    }[period] || 'YYYY-MM';

    const from = new Date(dateFrom || new Date(new Date().getFullYear(), 0, 1));
    const to = new Date(dateTo || new Date());

    const rides = await this.prisma.$queryRaw<
      { period: string; total: bigint; completed: bigint; canceled: bigint; revenue: number }[]
    >`
      SELECT
        TO_CHAR("createdAt", ${dateFormat}) as period,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'CANCELED' THEN 1 ELSE 0 END) as canceled,
        COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN "totalFare" ELSE 0 END), 0) as revenue
      FROM "Ride"
      WHERE "createdAt" BETWEEN ${from} AND ${to}
      GROUP BY period
      ORDER BY period
    `;

    return rides.map(r => ({
      period: r.period,
      total: Number(r.total),
      completed: Number(r.completed),
      canceled: Number(r.canceled),
      revenue: Number(r.revenue),
    }));
  }

  async getRecentRides(limit: number = 10) {
    const rides = await this.prisma.ride.findMany({
      select: {
        id: true,
        status: true,
        pickupAddress: true,
        destinationAddress: true,
        totalFare: true,
        createdAt: true,
        client: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        driver: {
          select: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return rides.map(r => ({
      id: r.id,
      status: r.status,
      pickupAddress: r.pickupAddress,
      destinationAddress: r.destinationAddress,
      totalFare: r.totalFare,
      createdAt: r.createdAt,
      clientName: r.client?.user
        ? `${r.client.user.firstName} ${r.client.user.lastName}`
        : '—',
      driverName: r.driver?.user
        ? `${r.driver.user.firstName} ${r.driver.user.lastName}`
        : '—',
    }));
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

  async getAllRides(page: number = 1, limit: number = 20, status?: string, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (search && search.trim()) {
      where.OR = [
        { pickupAddress: { contains: search, mode: 'insensitive' } },
        { destinationAddress: { contains: search, mode: 'insensitive' } },
        { client: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
        { client: { user: { lastName: { contains: search, mode: 'insensitive' } } } },
        { driver: { user: { firstName: { contains: search, mode: 'insensitive' } } } },
        { driver: { user: { lastName: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const [rides, total] = await Promise.all([
      this.prisma.ride.findMany({
        where,
        select: {
          id: true,
          status: true,
          pickupAddress: true,
          destinationAddress: true,
          distanceKm: true,
          durationMinutes: true,
          baseFare: true,
          totalFare: true,
          driverEarnings: true,
          platformFee: true,
          passengerCount: true,
          rideType: true,
          requestedAt: true,
          acceptedAt: true,
          startedAt: true,
          completedAt: true,
          canceledAt: true,
          createdAt: true,
          client: {
            select: {
              id: true,
              user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
            },
          },
          driver: {
            select: {
              id: true,
              rating: true,
              user: { select: { id: true, firstName: true, lastName: true, phone: true } },
            },
          },
          ratings: {
            select: { score: true, comment: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.ride.count({ where }),
    ]);

    return {
      rides,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
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
