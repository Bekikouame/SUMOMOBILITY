// src/modules/rides/controllers/cancellation-causes.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { CancellationCausesService } from '../services/cancellation-causes.service';

@ApiTags('Cancellation Causes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cancellation-causes')
export class CancellationCausesController {
  constructor(private readonly causesService: CancellationCausesService) {}

  @Get()
  @ApiOperation({ summary: 'Lister les causes d\'annulation' })
  @ApiQuery({ name: 'category', required: false, description: 'Filtrer par catégorie' })
  async findCauses(@Query('category') category?: string) {
    if (category) {
      return this.causesService.findByCategory(category);
    }
    return this.causesService.findAll();
  }
}
