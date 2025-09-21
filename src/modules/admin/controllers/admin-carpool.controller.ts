import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import { PrismaService } from '../../../prisma/prisma.service';
import { CarpoolService } from '../../carpool/carpool.service';
@ApiTags('Admin - Carpool')
@Controller('admin/carpool')
export class AdminCarpoolController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carpoolService: CarpoolService
  ) {}

  @Get('pending-requests')
  @ApiResponse({ status: 200, description: 'Demandes de covoiturage en attente' })
  async getPendingRequests(@Query('limit') limit = 20) {
    const requests = await this.prisma.carpoolRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        requester: { include: { user: true } },
        targetReservation: {
          include: {
            client: { include: { user: true } }
          }
        }
      },
      take: limit,
      orderBy: { createdAt: 'desc' }
    });

    return { success: true, requests };
  }

  @Put('request/:requestId/moderate')
  @ApiResponse({ status: 200, description: 'Modérer une demande de covoiturage' })
  async moderateRequest(
    @Param('requestId') requestId: string,
    @Body() body: { action: 'approve' | 'reject', reason?: string }
  ) {
    // Logique de modération si nécessaire
    const request = await this.prisma.carpoolRequest.update({
      where: { id: requestId },
      data: {
        status: body.action === 'approve' ? 'ACCEPTED' : 'REJECTED',
        responseMessage: body.reason,
        respondedAt: new Date()
      }
    });

    return { success: true, request };
  }

  @Get('problematic-routes')
  @ApiResponse({ status: 200, description: 'Routes avec problèmes de compatibilité' })
  async getProblematicRoutes() {
    // Routes avec beaucoup de rejets ou faible taux de succès
    const routes = await this.prisma.$queryRaw`
      SELECT 
        cr.pickup_address,
        cr.destination_address,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN cr.status = 'REJECTED' THEN 1 END) as rejected_count,
        COUNT(CASE WHEN cr.status = 'ACCEPTED' THEN 1 END) as accepted_count,
        AVG(cr.route_compatibility) as avg_compatibility
      FROM carpool_requests cr
      GROUP BY cr.pickup_address, cr.destination_address
      HAVING COUNT(*) > 3 
        AND (COUNT(CASE WHEN cr.status = 'REJECTED' THEN 1 END)::float / COUNT(*)) > 0.5
      ORDER BY rejected_count DESC
    `;

    return { success: true, routes };
  }
}