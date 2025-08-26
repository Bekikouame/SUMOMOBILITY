// src/reservations/reservations.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsService } from '../reservation/reservation.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole, ReservationStatus } from '@prisma/client';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    clientProfile: {
      findUnique: jest.fn(),
    },
    reservation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    ride: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockClientProfile = {
      id: 'client-id',
      userId: 'user-id',
      user: { id: 'user-id', firstName: 'John', lastName: 'Doe' }
    };

    const createReservationDto = {
      scheduledAt: '2024-12-01T14:00:00.000Z',
      pickupAddress: 'Cocody',
      destinationAddress: 'Aéroport',
      estimatedDistance: 15,
      passengerCount: 2,
    };

    it('devrait créer une réservation avec succès', async () => {
      const mockReservation = {
        id: 'reservation-id',
        clientId: 'client-id',
        status: ReservationStatus.PENDING,
        estimatedPrice: 3500,
        scheduledAt: new Date(createReservationDto.scheduledAt),
        pickupAddress: createReservationDto.pickupAddress,
        destinationAddress: createReservationDto.destinationAddress,
        estimatedDistance: createReservationDto.estimatedDistance,
        passengerCount: createReservationDto.passengerCount,
        notes: undefined,
        rideId: null,
        cancellationCauseId: null,
        canceledAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        client: mockClientProfile,
        cancellationCause: null,
        payments: [],
      };


      mockPrismaService.clientProfile.findUnique.mockResolvedValue(mockClientProfile);
      mockPrismaService.reservation.create.mockResolvedValue(mockReservation);

      const result = await service.create('client-id', createReservationDto);

      expect(result).toEqual(mockReservation);
      expect(mockPrismaService.reservation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: 'client-id',
          scheduledAt: new Date(createReservationDto.scheduledAt),
          estimatedPrice: 3500, // 500 base + 15km * 200
        }),
        include: expect.any(Object),
      });
    });

    it('devrait rejeter une date dans le passé', async () => {
      const pastDate = {
        ...createReservationDto,
        scheduledAt: '2020-01-01T14:00:00.000Z',
      };

      await expect(service.create('client-id', pastDate)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('devrait rejeter si le client n\'existe pas', async () => {
      mockPrismaService.clientProfile.findUnique.mockResolvedValue(null);

      await expect(service.create('invalid-client-id', createReservationDto))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('convertToRide', () => {
    const mockReservation = {
      id: 'reservation-id',
      clientId: 'client-id',
      status: ReservationStatus.CONFIRMED,
      scheduledAt: new Date(Date.now() + 30 * 60 * 1000), // Dans 30 minutes
      rideId: null,
      estimatedPrice: 3000,
      pickupAddress: 'Cocody',
      destinationAddress: 'Aéroport',
      passengerCount: 1,
      notes: 'Test',
    };

    it('devrait convertir une réservation en course', async () => {
      const mockRide = {
        id: 'ride-id',
        clientId: 'client-id',
        status: 'REQUESTED',
        requestedAt: new Date(),
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(mockReservation);
      mockPrismaService.$transaction.mockResolvedValue([mockRide, mockReservation]);
      mockPrismaService.reservation.update.mockResolvedValue({
        ...mockReservation,
        rideId: 'ride-id',
        status: ReservationStatus.FULFILLED,
      });

      const result = await service.convertToRide('reservation-id', 'user-id', UserRole.CLIENT);

      expect(result.ride).toEqual(mockRide);
      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });

    it('devrait rejeter si trop tôt pour la conversion', async () => {
      const futureReservation = {
        ...mockReservation,
        scheduledAt: new Date(Date.now() + 5 * 60 * 60 * 1000), // Dans 5 heures
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(futureReservation);

      await expect(
        service.convertToRide('reservation-id', 'user-id', UserRole.CLIENT)
      ).rejects.toThrow(BadRequestException);
    });

    it('devrait rejeter si la réservation est expirée', async () => {
      const expiredReservation = {
        ...mockReservation,
        scheduledAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Il y a 2 heures
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(expiredReservation);

      await expect(
        service.convertToRide('reservation-id', 'user-id', UserRole.CLIENT)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getStats', () => {
    it('devrait retourner les statistiques correctes', async () => {
      const mockStats = [10, 3, 5, 2, 0, { _sum: { estimatedPrice: 15000 } }];
      
      mockPrismaService.clientProfile.findUnique.mockResolvedValue({ id: 'client-id' });
      jest.spyOn(Promise, 'all').mockResolvedValue(mockStats);

      const result = await service.getStats('user-id', UserRole.CLIENT);

      expect(result).toEqual({
        total: 10,
        byStatus: {
          pending: 3,
          confirmed: 5,
          fulfilled: 2,
          canceled: 0,
        },
        totalEarnings: 15000,
        conversionRate: 20, // 2/10 * 100
      });
    });
  });
});
