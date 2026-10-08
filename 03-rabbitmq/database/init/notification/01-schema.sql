CREATE DATABASE IF NOT EXISTS notifications;
USE notifications;
CREATE TABLE IF NOT EXISTS Notifications (
  eventId CHAR(36) PRIMARY KEY,
  type VARCHAR(80) NOT NULL,
  deviceId INT NOT NULL,
  ownerType VARCHAR(20) NOT NULL,
  ownerId INT NOT NULL,
  payload JSON NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE USER IF NOT EXISTS 'notification_user'@'%' IDENTIFIED BY 'notification_pass';
GRANT SELECT, INSERT ON notifications.Notifications TO 'notification_user'@'%';
