// src/payments/tests/payments.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from '../payments.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;

  const mockPrisma = {
    payment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
    ridePayment: {
      create: jest.fn(),
    },
    reservationPayment: {
      create: jest.fn(),
    },
    ride: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    reservation: {
      findUnique: jest.fn(),
    },
    driverProfile: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('createPayment', () => {
    it('should create a payment for a ride', async () => {
      const createPaymentDto: CreatePaymentDto = {
        amount: 5000,
        method: PaymentMethod.MOBILE_MONEY,
        rideId: 'ride-123',
        paymentType: 'FARE',
      };

      const mockRide = { id: 'ride-123', clientId: 'client-123' };
      const mockPayment = {
        id: 'payment-123',
        amount: 5000,
        method: PaymentMethod.MOBILE_MONEY,
        status: PaymentStatus.PENDING,
      };

      mockPrisma.ride.findUnique.mockResolvedValue(mockRide);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        mockPrisma.payment.create.mockResolvedValue(mockPayment);
        mockPrisma.ridePayment.create.mockResolvedValue({});
        return callback(mockPrisma);
      });

      const result = await service.createPayment(createPaymentDto);

      expect(mockPrisma.ride.findUnique).toHaveBeenCalledWith({
        where: { id: 'ride-123' },
      });
      expect(result).toBeDefined();
    });

    it('should throw error if ride not found', async () => {
      const createPaymentDto: CreatePaymentDto = {
        amount: 5000,
        method: PaymentMethod.MOBILE_MONEY,
        rideId: 'nonexistent-ride',
      };

      mockPrisma.ride.findUnique.mockResolvedValue(null);

      await expect(service.createPayment(createPaymentDto)).rejects.toThrow(
        'Course non trouvée'
      );
    });
  });

  describe('getDriverEarnings', () => {
    it('should calculate driver earnings correctly', async () => {
      const mockDriver = {
        id: 'driver-123',
        user: { firstName: 'John', lastName: 'Doe' },
        totalRides: 10,
        rating: 4.5,
      };

      const mockRides = [
        {
          id: 'ride-1',
          completedAt: new Date(),
          totalFare: { toNumber: () => 3000 },
          driverEarnings: { toNumber: () => 2550 },
          platformFee: { toNumber: () => 450 },
          pickupAddress: 'Address A',
          destinationAddress: 'Address B',
          payments: [
            {
              payment: {
                amount: { toNumber: () => 3000 },
              },
            },
          ],
        },
      ];

      mockPrisma.driverProfile.findUnique.mockResolvedValue(mockDriver);
      mockPrisma.ride.findMany.mockResolvedValue(mockRides);

      const result = await service.getDriverEarnings('driver-123');

      expect(result.driver.name).toBe('John Doe');
      expect(result.earnings.totalEarnings).toBe(2550);
      expect(result.earnings.averagePerRide).toBe(2550);
    });
  });
});