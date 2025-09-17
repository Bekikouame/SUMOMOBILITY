//  src/admin/services/user-management.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { UpdateUserStatusDto, BulkUserActionDto } from '../dto/user-management.dto';
import { AdminLogService } from './admin-log.service';
import { UserRole, Prisma } from '@prisma/client'; // Import ajouté

@Injectable()
export class UserManagementService {
  constructor(
    private prisma: PrismaService,
    private adminLog: AdminLogService,
  ) {}

  async getAllUsers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    role?: string,
    status?: string,
  ) {
    const skip = (page - 1) * limit;
    
    // Construction du where avec validation du rôle
    const where: Prisma.UserWhereInput = {};

    // Recherche textuelle
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtre par rôle avec validation
    if (role) {
      if (this.isValidUserRole(role)) {
        where.role = role as UserRole;
      } else {
        throw new BadRequestException(
          `Rôle invalide: ${role}. Rôles valides: ${Object.values(UserRole).join(', ')}`
        );
      }
    }

    // Filtre par statut
    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          country: true,
          city: true,
          lastLoginAt: true,
          createdAt: true,
          clientProfile: {
            select: {
              loyaltyPoints: true,
              vipStatus: true,
              _count: { select: { rides: true } },
            },
          },
          driverProfile: {
            select: {
              status: true,
              rating: true,
              totalRides: true,
              totalEarnings: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        clientProfile: {
          include: {
            rides: {
              select: {
                id: true,
                status: true,
                totalFare: true,
                createdAt: true,
                pickupAddress: true,
                destinationAddress: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
            reservations: {
              select: {
                id: true,
                status: true,
                scheduledAt: true,
                pickupAddress: true,
                destinationAddress: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 5,
            },
          },
        },
        driverProfile: {
          include: {
            documents: {
              select: {
                id: true,
                docType: true,
                status: true,
                expiresAt: true,
              },
            },
            vehicles: {
              select: {
                id: true,
                plateNumber: true,
                brand: true,
                model: true,
                status: true,
                verified: true,
              },
            },
            rides: {
              select: {
                id: true,
                status: true,
                totalFare: true,
                driverEarnings: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    return user;
  }

  async updateUserStatus(
    userId: string,
    dto: UpdateUserStatusDto,
    adminId: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.isActive },
    });

    //  Mettre à jour aussi le profil chauffeur si c'est un driver
  if (user.role === UserRole.DRIVER) {
    await this.prisma.driverProfile.updateMany({
      where: { userId: userId },
      data: { 
        status: dto.isActive ? 'APPROVED' : 'PENDING' 
      }
    });
  }


    // Log de l'action
    await this.adminLog.log(adminId, {
      action: 'UPDATE_USER_STATUS',
      resource: 'USER',
      resourceId: userId,
      oldValues: { isActive: user.isActive },
      newValues: { isActive: dto.isActive, reason: dto.reason },
    });

    return updatedUser;
  }

  async bulkUserAction(dto: BulkUserActionDto, adminId: string) {
    const { userIds, action, reason } = dto;

    let result;
    switch (action) {
      case 'activate':
        result = await this.prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: true },
        });
        break;
      
      case 'deactivate':
        result = await this.prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: false },
        });
        break;
      
      case 'delete':
        // Soft delete - on désactive plutôt que supprimer
        result = await this.prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { isActive: false },
        });
        break;
      
      default:
        throw new BadRequestException('Action non supportée');
    }

    // Log de l'action groupée
    await this.adminLog.log(adminId, {
      action: `BULK_${action.toUpperCase()}`,
      resource: 'USER',
      newValues: { userIds, reason, count: result.count },
    });

    return { affected: result.count };
  }

  async getUserStats() {
    const [
      totalUsers,
      activeUsers,
      clientsCount,
      driversCount,
      newUsersToday,
      newUsersWeek,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      // Correction : utiliser l'enum UserRole au lieu de string
      this.prisma.user.count({ where: { role: UserRole.CLIENT } }),
      this.prisma.user.count({ where: { role: UserRole.DRIVER } }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    return {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      clients: clientsCount,
      drivers: driversCount,
      newToday: newUsersToday,
      newThisWeek: newUsersWeek,
      activityRate: totalUsers > 0 ? (activeUsers / totalUsers * 100).toFixed(1) : 0,
    };
  }

  // Méthode utilitaire pour valider les rôles
  private isValidUserRole(role: string): role is UserRole {
    return Object.values(UserRole).includes(role as UserRole);
  }

  // Méthode utilitaire pour obtenir tous les rôles disponibles
  getAvailableRoles(): UserRole[] {
    return Object.values(UserRole);
  }
}