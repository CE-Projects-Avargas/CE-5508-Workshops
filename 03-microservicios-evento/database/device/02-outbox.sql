-- Outbox: el evento se guarda en la misma transaccion que el cambio; device-service lo publica despues en RabbitMQ.
-- publicadoEn NULL = pendiente. Si RabbitMQ falla, el evento sigue aqui y se reintenta.
CREATE TABLE IF NOT EXISTS EventosPendientes (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    eventId VARCHAR(64) NOT NULL UNIQUE,
    routingKey VARCHAR(100) NOT NULL,
    payload JSON NOT NULL,
    intentos INT UNSIGNED NOT NULL DEFAULT 0,
    ultimoError VARCHAR(500) NULL,
    creadoEn TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    publicadoEn TIMESTAMP(3) NULL DEFAULT NULL,

    INDEX idx_eventos_pendientes (publicadoEn, id)
)   ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
    COLLATE=utf8mb4_unicode_ci;
