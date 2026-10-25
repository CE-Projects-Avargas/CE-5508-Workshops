CREATE DATABASE IF NOT EXISTS dispositivos;
USE dispositivos;

-- Un dispositivo pertenece a un usuario o a un proyecto (ownerType + ownerId).
CREATE TABLE IF NOT EXISTS Devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  serial VARCHAR(100) NOT NULL UNIQUE,
  nombre VARCHAR(255) NOT NULL,
  ownerType ENUM('user', 'project') NOT NULL DEFAULT 'user',
  ownerId INT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Anomalias reportadas por un dispositivo.
CREATE TABLE IF NOT EXISTS Alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deviceId INT NOT NULL,
  level ENUM('info', 'warning', 'critical') NOT NULL,
  message VARCHAR(500) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (deviceId) REFERENCES Devices(id) ON DELETE CASCADE
);