CREATE DATABASE IF NOT EXISTS notifications
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE notifications;

CREATE TABLE IF NOT EXISTS Notifications (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,

  eventId CHAR(36) NOT NULL,
  eventType VARCHAR(100) NOT NULL,

  deviceId INT NOT NULL,
  ownerType ENUM('user', 'project') NOT NULL,
  ownerId INT NOT NULL,
  usuarioId INT NOT NULL,

  level ENUM('info', 'warning', 'critical') NOT NULL,
  message TEXT NOT NULL,

  occurredAt DATETIME(3) NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT uq_notification_event UNIQUE (eventId),
  INDEX idx_notification_device (deviceId),
  INDEX idx_notification_owner (ownerType, ownerId)
);

CREATE USER IF NOT EXISTS 'notification_user'@'%'
  IDENTIFIED BY 'notification_pass';

GRANT SELECT, INSERT
  ON notifications.Notifications
  TO 'notification_user'@'%';
