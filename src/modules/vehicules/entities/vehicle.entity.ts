// / src/vehicles/entities/vehicle.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { VehicleStatus } from '@prisma/client';

export class VehicleEntity {
  @ApiProperty({ description: 'ID unique du véhicule' })
  id: string;

  @ApiProperty({ description: 'Numéro de plaque d\'immatriculation' })
  plateNumber: string;

  @ApiProperty({ description: 'Marque du véhicule' })
  brand: string;

  @ApiProperty({ description: 'Modèle du véhicule' })
  model: string;

  @ApiProperty({ description: 'Couleur du véhicule' })
  color: string;

  @ApiProperty({ description: 'Année du véhicule', required: false })
  year?: number;

  @ApiProperty({ description: 'Capacité passagers' })
  capacity: number;

  @ApiProperty({ description: 'Statut du véhicule', enum: VehicleStatus })
  status: VehicleStatus;

  @ApiProperty({ description: 'Véhicule vérifié par admin' })
  verified: boolean;

  @ApiProperty({ description: 'Date de vérification', required: false })
  verifiedAt?: Date;

  @ApiProperty({ description: 'ID du chauffeur propriétaire' })
  driverId: string;

  @ApiProperty({ description: 'Date de création' })
  createdAt: Date;

  @ApiProperty({ description: 'Date de dernière modification' })
  updatedAt: Date;
}
