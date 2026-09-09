-- ─────────────────────────────────────────────────────────────
-- CE5508 — Modelo de datos FINAL
--
-- Referencia del esquema completo al terminar los seis talleres.
-- Cada taller aporta sus tablas; el orden de creación respeta
-- las dependencias entre ellas.
-- ─────────────────────────────────────────────────────────────

USE dispositivos_medicos;

-- ═══════════════ TALLER 1 ═══════════════

CREATE TABLE IF NOT EXISTS Usuarios (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  email     VARCHAR(255) NOT NULL UNIQUE,
  password  VARCHAR(255) NOT NULL,          -- hash, nunca texto plano
  nombre    VARCHAR(255) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Un Proyecto es el MODELO de dispositivo en desarrollo.
CREATE TABLE IF NOT EXISTS Proyectos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(255) NOT NULL,
  encargado       VARCHAR(255) NOT NULL,
  descripcion     TEXT,
  tipoDispositivo VARCHAR(255),
  criticidad      ENUM('bajo','medio','alto','critico')            NOT NULL DEFAULT 'medio',
  estado          ENUM('planificacion','desarrollo','pruebas','produccion')
                                                                    NOT NULL DEFAULT 'planificacion',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ═══════════════ TALLER 2 ═══════════════

-- Un Dispositivo es una UNIDAD DESPLEGADA de un Proyecto.
-- Solo los dispositivos reportan telemetría.
CREATE TABLE IF NOT EXISTS Dispositivos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  deviceId    VARCHAR(64)  NOT NULL UNIQUE,   -- ej. 'BIV2-0042'
  proyectoId  INT          NOT NULL,
  ubicacion   VARCHAR(255),                   -- ej. 'Ala Norte · Cama 12'
  firmware    VARCHAR(32),                    -- ej. '2.4.1'
  estado      ENUM('activo','mantenimiento','retirado') NOT NULL DEFAULT 'activo',
  ultimoVisto DATETIME NULL,                  -- lo actualiza telemetry-consumer
  createdAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_disp_proyecto FOREIGN KEY (proyectoId) REFERENCES Proyectos(id),
  INDEX idx_disp_estado (estado)
);

-- Lecturas enviadas por los dispositivos.
CREATE TABLE IF NOT EXISTS Telemetria (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  deviceId     VARCHAR(64) NOT NULL,
  seq          BIGINT      NOT NULL,          -- incremental por dispositivo
  ts           DATETIME(3) NOT NULL,          -- generado por el DISPOSITIVO
  caudalMlH    DECIMAL(7,2),
  presionKpa   DECIMAL(7,2),
  bateriaPct   TINYINT UNSIGNED,
  aireEnLinea  BOOLEAN     NOT NULL DEFAULT FALSE,
  estado       ENUM('infundiendo','detenido','alarma','standby') NOT NULL,
  recibidoEn   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  -- ── La restricción que hace segura la reentrega ──
  -- Kafka garantiza "al menos una vez": el mismo mensaje puede
  -- llegar dos veces. Esta llave hace que reprocesarlo no duplique.
  -- Es el corazón del reto del Taller 2.
  UNIQUE KEY uk_dispositivo_seq (deviceId, seq),

  INDEX idx_tel_device_ts (deviceId, ts),
  CONSTRAINT fk_tel_dispositivo FOREIGN KEY (deviceId)
    REFERENCES Dispositivos(deviceId) ON DELETE CASCADE
);

-- Generadas por alert-service al cruzar un umbral.
CREATE TABLE IF NOT EXISTS Alertas (
  id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  deviceId   VARCHAR(64) NOT NULL,
  tipo       ENUM('aire_en_linea','sobrepresion','bateria_baja','sin_reporte') NOT NULL,
  severidad  ENUM('info','advertencia','critica') NOT NULL,
  mensaje    VARCHAR(500) NOT NULL,
  valor      DECIMAL(10,2),                   -- valor que disparó la alerta
  ts         DATETIME(3) NOT NULL,
  atendida   BOOLEAN NOT NULL DEFAULT FALSE,
  createdAt  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_alerta_device_ts (deviceId, ts),
  INDEX idx_alerta_atendida (atendida),
  CONSTRAINT fk_alerta_dispositivo FOREIGN KEY (deviceId)
    REFERENCES Dispositivos(deviceId) ON DELETE CASCADE
);

-- ═══════════════ Umbrales (config de alert-service) ═══════════════

CREATE TABLE IF NOT EXISTS Umbrales (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  proyectoId INT NOT NULL,                    -- umbrales por MODELO
  metrica    VARCHAR(64) NOT NULL,            -- 'presionKpa', 'bateriaPct'...
  operador   ENUM('>','<','>=','<=','==') NOT NULL,
  valor      DECIMAL(10,2) NOT NULL,
  severidad  ENUM('info','advertencia','critica') NOT NULL,
  CONSTRAINT fk_umbral_proyecto FOREIGN KEY (proyectoId) REFERENCES Proyectos(id),
  UNIQUE KEY uk_umbral (proyectoId, metrica, operador, valor)
);
