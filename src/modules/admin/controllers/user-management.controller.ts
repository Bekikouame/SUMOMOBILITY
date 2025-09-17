// src/admin/controllers/user-management.controller.ts
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard} from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { UserManagementService } from '../services/user-management.service';
import { UpdateUserStatusDto, BulkUserActionDto } from '../dto/user-management.dto';

@ApiTags('Admin User Management')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class UserManagementController {
  constructor(private readonly userManagementService: UserManagementService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des utilisateurs' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false, enum: ['CLIENT', 'DRIVER', 'ADMIN'] })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'inactive'] })
  getAllUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    return this.userManagementService.getAllUsers(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
      role,
      status,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques utilisateurs' })
  getUserStats() {
    return this.userManagementService.getUserStats();
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Détails d\'un utilisateur' })
  getUserDetails(@Param('userId') userId: string) {
    return this.userManagementService.getUserDetails(userId);
  }

  @Patch(':userId/status')
  @ApiOperation({ summary: 'Modifier le statut d\'un utilisateur' })
  updateUserStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() admin: any,
  ) {
    return this.userManagementService.updateUserStatus(userId, dto, admin.id);
  }

  @Post('bulk-action')
  @ApiOperation({ summary: 'Action groupée sur les utilisateurs' })
  bulkUserAction(
    @Body() dto: BulkUserActionDto,
    @CurrentUser() admin: any,
  ) {
    return this.userManagementService.bulkUserAction(dto, admin.id);
  }
}
