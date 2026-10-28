-- Una notificacion por evento procesado. eventId UNIQUE impide duplicados aunque el evento llegue dos veces.
CREATE TABLE IF NOT EXISTS Notificaciones (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    eventId VARCHAR(64) NOT NULL UNIQUE,
    tipo VARCHAR(64) NOT NULL,
    deviceId INT UNSIGNED NOT NULL,
    ownerType ENUM('user', 'project') NULL,
    ownerId INT UNSIGNED NULL,
    nivel VARCHAR(32) NULL,
    mensaje VARCHAR(500) NOT NULL,
    payload JSON NOT NULL,
    ocurridoEn DATETIME(3) NOT NULL,
    procesadoEn DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX idx_notificaciones_device (deviceId)
)   ENGINE=InnoDB
    DEFAULT CHARSET=utf8mb4
    COLLATE=utf8mb4_unicode_ci;
