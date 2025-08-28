// / src/notifications/interfaces/vnotification.interface.ts

import { NotificationStatus, NotificationType, NotificationChannel } from '@prisma/client';
import { Notification as NotificationModel } from '@prisma/client';


export interface NotificationFilters {
  status?: NotificationStatus;
  type?: NotificationType;
  channel?: NotificationChannel;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface SendNotificationParams {
  type: NotificationType;
  userId: string;
  channels?: NotificationChannel[];
  variables?: Record<string, any>;
  metadata?: Record<string, any>;
  priority?: number;
  scheduleAt?: Date;
}

export interface INotificationService {
  sendNotification(params: SendNotificationParams): Promise<void>;
  sendBulkNotifications(notifications: SendNotificationParams[]): Promise<void>;
  // The correct and unique method signature
  getNotifications(userId: string, filters?: NotificationFilters): Promise<NotificationModel[]>;
  markAsRead(notificationId: string, userId: string): Promise<void>;
  retryFailedNotifications(): Promise<void>;
}