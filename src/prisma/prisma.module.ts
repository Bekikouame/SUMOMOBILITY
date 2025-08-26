import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Rend PrismaService disponible dans toute l'application
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}