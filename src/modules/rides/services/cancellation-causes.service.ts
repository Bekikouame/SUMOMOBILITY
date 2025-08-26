// / src/modules/rides/services/cancellation-causes.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class CancellationCausesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.cancellationCause.findMany({
      where: { active: true },
      orderBy: { category: 'asc' }
    });
  }

  async findByCategory(category: string) {
    return this.prisma.cancellationCause.findMany({
      where: { 
        active: true,
        category: category.toUpperCase()
      },
      orderBy: { label: 'asc' }
    });
  }

  async create(data: { label: string; description?: string; category?: string }) {
    return this.prisma.cancellationCause.create({
      data: {
        label: data.label,
        description: data.description,
        category: data.category?.toUpperCase() || 'GENERAL'
      }
    });
  }
}
