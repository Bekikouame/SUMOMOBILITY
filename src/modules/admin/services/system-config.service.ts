// src/admin/services/system-config.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateSystemConfigDto, UpdateSystemConfigDto } from '../dto/system-config.dto';

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSystemConfigDto, adminId: string) {
    const existing = await this.prisma.systemConfig.findUnique({
      where: { key: dto.key },
    });

    if (existing) {
      throw new ConflictException('Cette clé existe déjà');
    }

    return this.prisma.systemConfig.create({
      data: {
        ...dto,
        updatedBy: adminId,
      },
    });
  }

  async findAll(category?: string, isPublic?: boolean) {
    return this.prisma.systemConfig.findMany({
      where: {
        ...(category && { category }),
        ...(isPublic !== undefined && { isPublic }),
      },
      orderBy: [
        { category: 'asc' },
        { key: 'asc' },
      ],
    });
  }

  async findByKey(key: string) {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    if (!config) {
      throw new NotFoundException('Configuration non trouvée');
    }

    return config;
  }

  async update(key: string, dto: UpdateSystemConfigDto, adminId: string) {
    await this.findByKey(key);

    return this.prisma.systemConfig.update({
      where: { key },
      data: {
        ...dto,
        updatedBy: adminId,
      },
    });
  }

  async delete(key: string) {
    await this.findByKey(key);
    
    return this.prisma.systemConfig.delete({
      where: { key },
    });
  }

  // Méthodes utilitaires
  async getValue(key: string, defaultValue?: any) {
    const config = await this.prisma.systemConfig.findUnique({
      where: { key },
    });

    return config?.value ?? defaultValue;
  }

  async getPublicConfigs() {
    const configs = await this.prisma.systemConfig.findMany({
      where: { isPublic: true },
      select: { key: true, value: true },
    });

    return configs.reduce((acc, config) => {
      acc[config.key] = config.value;
      return acc;
    }, {});
  }
}
