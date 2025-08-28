// Créer ce fichier si les imports directs ne marchent pas

import { Prisma } from '@prisma/client';

// Export des enums via Prisma namespace
export const NotificationType = {
  RIDE_REQUEST: 'RIDE_REQUEST',
  RIDE_ACCEPTED: 'RIDE_ACCEPTED', 
  RIDE_STARTED: 'RIDE_STARTED',
  RIDE_COMPLETED: 'RIDE_COMPLETED',
  RIDE_CANCELED: 'RIDE_CANCELED',
  RESERVATION_REMINDER: 'RESERVATION_REMINDER',
  DOCUMENT_EXPIRED: 'DOCUMENT_EXPIRED',
  DOCUMENT_APPROVED: 'DOCUMENT_APPROVED',
  DOCUMENT_REJECTED: 'DOCUMENT_REJECTED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  DRIVER_APPROVED: 'DRIVER_APPROVED',
  SYSTEM_MAINTENANCE: 'SYSTEM_MAINTENANCE'
} as const;

export const NotificationChannel = {
  PUSH: 'PUSH',
  EMAIL: 'EMAIL',
  SMS: 'SMS',
  IN_APP: 'IN_APP'
} as const;

export const NotificationStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT', 
  FAILED: 'FAILED',
  READ: 'READ'
} as const;

// Types TypeScript
export type NotificationType = keyof typeof NotificationType;
export type NotificationChannel = keyof typeof NotificationChannel;
export type NotificationStatus = keyof typeof NotificationStatus;
