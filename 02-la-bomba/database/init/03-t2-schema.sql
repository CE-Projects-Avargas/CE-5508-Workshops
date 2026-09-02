-- CE5508 · Taller 2 — Tablas nuevas
-- Se ejecuta después de 01-schema.sql y 02-seed.sql (orden alfabético).

USE dispositivos_medicos;

-- Los proyectos ahora tienen dueño: base de la propiedad de datos.
ALTER TABLE Proyectos
  ADD COLUMN ownerId INT NOT NULL DEFAULT 1,
  ADD CONSTRAINT fk_proyecto_owner FOREIGN KEY (ownerId) REFERENCES Usuarios(id);

-- Catálogo de productos que una bomba puede administrar.
CREATE TABLE IF NOT EXISTS Productos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL UNIQUE,
  concentracion VARCHAR(60),                    -- '0.9%', '5 mg/ml'
  unidad        VARCHAR(20) NOT NULL DEFAULT 'ml',
  createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Un proyecto tiene N bombas.
CREATE TABLE IF NOT EXISTS Bombas (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  serie              VARCHAR(64)  NOT NULL UNIQUE,
  proyectoId         INT          NOT NULL,
  ubicacion          VARCHAR(255),
  productoId         INT NULL,                   -- qué administra esta bomba
  estado             ENUM('detenida','programada','infundiendo','pausada','completada')
                     NOT NULL DEFAULT 'detenida',
  caudalMlH          DECIMAL(7,2) NOT NULL DEFAULT 0,
  volumenObjetivoMl  DECIMAL(8,2) NOT NULL DEFAULT 0,
  volumenEntregadoMl DECIMAL(8,2) NOT NULL DEFAULT 0,
  programadaPara     DATETIME NULL,              -- si está fijada, arranca sola
  iniciadaEn         DATETIME NULL,
  actualizadaEn      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                     ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bomba_proyecto FOREIGN KEY (proyectoId) REFERENCES Proyectos(id),
  CONSTRAINT fk_bomba_producto FOREIGN KEY (productoId) REFERENCES Productos(id),
  INDEX idx_bomba_proyecto (proyectoId),
  INDEX idx_bomba_programada (estado, programadaPara)
);

-- Auditoría: toda acción de control queda registrada con su responsable.
CREATE TABLE IF NOT EXISTS EventosControl (
  id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  bombaId   INT         NOT NULL,
  usuarioId INT         NOT NULL,
  accion    ENUM('crear','editar','eliminar','iniciar','pausar','detener','programar') NOT NULL,
  detalle   JSON,
  ts        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_evento_bomba   FOREIGN KEY (bombaId)   REFERENCES Bombas(id),
  CONSTRAINT fk_evento_usuario FOREIGN KEY (usuarioId) REFERENCES Usuarios(id),
  INDEX idx_evento_bomba_ts (bombaId, ts)
);
