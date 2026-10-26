CREATE DATABASE IF NOT EXISTS devices;
USE devices;
CREATE TABLE IF NOT EXISTS Devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  serial VARCHAR(64) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  ownerType ENUM('user', 'project') NOT NULL,
  ownerId INT NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_owner (ownerType, ownerId)
);
-- Dispositivo y evento se guardan en una transacción; publicación con reintentos.
CREATE TABLE IF NOT EXISTS Outbox (
  eventId CHAR(36) PRIMARY KEY,
  payload JSON NOT NULL,
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  publishedAt DATETIME(3) NULL,
  INDEX idx_pending (publishedAt, createdAt)
);
CREATE USER IF NOT EXISTS 'device_user'@'%' IDENTIFIED BY 'device_pass';
GRANT SELECT, INSERT ON devices.Devices TO 'device_user'@'%';
GRANT SELECT, INSERT, UPDATE ON devices.Outbox TO 'device_user'@'%';
