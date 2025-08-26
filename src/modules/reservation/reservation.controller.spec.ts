// src/reservations/reservations.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsController } from './reservation.controller';
import { ReservationsService } from '../reservation/reservation.service';
import { UserRole, ReservationStatus } from '@prisma/client';

describe('ReservationsController', () => {
  let controller: ReservationsController;
  let service: ReservationsService;

  const mockReservationsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn(),
    convertToRide: jest.fn(),
    getStats: jest.fn(),
    getUpcomingReservations: jest.fn(),
    prisma: {
      clientProfile: {
        findUnique: jest.fn(),
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservationsController],
      providers: [
        {
          provide: ReservationsService,
          useValue: mockReservationsService,
        },
      ],
    }).compile();

    controller = module.get<ReservationsController>(ReservationsController);
    service = module.get<ReservationsService>(ReservationsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('devrait créer une réservation', async () => {
      const mockRequest = {
        user: { sub: 'user-id', role: UserRole.CLIENT }
      };
      const mockClientProfile = { id: 'client-id' };
      const createDto = {
        scheduledAt: '2024-12-01T14:00:00.000Z',
        pickupAddress: 'Cocody',
        destinationAddress: 'Aéroport',
      };
      const mockReservation = { id: 'reservation-id', ...createDto };

      mockReservationsService.prisma.clientProfile.findUnique.mockResolvedValue(mockClientProfile);
      mockReservationsService.create.mockResolvedValue(mockReservation);

      const result = await controller.create(mockRequest, createDto);

      expect(result).toEqual(mockReservation);
      expect(service.create).toHaveBeenCalledWith('client-id', createDto);
    });
  });

  describe('findAll', () => {
    it('devrait retourner toutes les réservations avec filtres', async () => {
      const mockRequest = {
        user: { sub: 'user-id', role: UserRole.CLIENT }
      };
      const mockReservations = [
        { id: 'res1', status: ReservationStatus.PENDING },
        { id: 'res2', status: ReservationStatus.CONFIRMED },
      ];

      mockReservationsService.findAll.mockResolvedValue(mockReservations);

      const result = await controller.findAll(
        mockRequest,
        ReservationStatus.PENDING,
        '2024-03-01',
        '2024-03-31'
      );

      expect(result).toEqual(mockReservations);
      expect(service.findAll).toHaveBeenCalledWith(
        'user-id',
        UserRole.CLIENT,
        {
          status: ReservationStatus.PENDING,
          scheduledFrom: '2024-03-01',
          scheduledTo: '2024-03-31',
        }
      );
    });
  });

  describe('convertToRide', () => {
    it('devrait convertir une réservation en course', async () => {
      const mockRequest = {
        user: { sub: 'user-id', role: UserRole.CLIENT }
      };
      const convertDto = { rideType: 'PREMIUM' };
      const mockResult = {
        reservation: { id: 'reservation-id', status: ReservationStatus.FULFILLED },
        ride: { id: 'ride-id', status: 'REQUESTED' }
      };

      mockReservationsService.convertToRide.mockResolvedValue(mockResult);

      const result = await controller.convertToRide('reservation-id', mockRequest, convertDto);

      expect(result).toEqual(mockResult);
      expect(service.convertToRide).toHaveBeenCalledWith(
        'reservation-id',
        'user-id',
        UserRole.CLIENT,
        convertDto
      );
    });
  });
});
