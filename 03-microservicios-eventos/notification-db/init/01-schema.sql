CREATE DATABASE IF NOT EXISTS notificaciones;
USE notificaciones;

-- Una notificacion por cada evento procesado.
-- eventId UNIQUE es lo que hace al consumidor idempotente: si RabbitMQ entrega
-- dos veces el mismo evento, el segundo INSERT choca y se descarta.
CREATE TABLE IF NOT EXISTS Notificaciones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  eventId CHAR(36) NOT NULL UNIQUE,
  type VARCHAR(100) NOT NULL,
  deviceId INT NOT NULL,
  userId INT NOT NULL,              -- referencia al usuario (sin FK: vive en auth-db)
  mensaje VARCHAR(700) NOT NULL,    -- texto legible de la notificacion
  payload TEXT NOT NULL,            -- el evento tal cual llego, para auditoria
  occurredAt DATETIME(3) NOT NULL,  -- cuando ocurrio (lo dice el productor)
  createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)  -- cuando se proceso
);
