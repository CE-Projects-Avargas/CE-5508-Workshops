-- ═══════════════════════════════════════════════════════════════
--  BASE DE OPERACIÓN
--
--  El dominio del negocio: proyectos, bombas, productos y auditoría.
--  La comparten el backend y el servicio de bombas — pero cada uno
--  entra con su propio usuario y sus propios permisos.
--
--  OJO con lo que ya NO se puede hacer: los usuarios viven en otra
--  base, así que ownerId y usuarioId son identificadores sueltos.
--  El motor ya no puede garantizar que apunten a alguien real.
--  Esa garantía pasó a ser responsabilidad del código.
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS operacion;
USE operacion;

-- Un Proyecto es el modelo de dispositivo. Pertenece a un usuario.
CREATE TABLE IF NOT EXISTS Proyectos (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(255) NOT NULL,
  encargado       VARCHAR(255) NOT NULL,
  descripcion     TEXT,
  tipoDispositivo VARCHAR(255),
  criticidad      ENUM('bajo','medio','alto','critico') NOT NULL DEFAULT 'medio',
  estado          ENUM('planificacion','desarrollo','pruebas','produccion')
                  NOT NULL DEFAULT 'planificacion',

  -- Sin FOREIGN KEY: el usuario vive en la base de autenticación.
  -- Cruzar la frontera de un servicio cuesta esta garantía.
  ownerId         INT NOT NULL,

  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_proyecto_owner (ownerId)
);

-- Catálogo de productos administrables.
CREATE TABLE IF NOT EXISTS Productos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(120) NOT NULL UNIQUE,
  concentracion VARCHAR(60),
  unidad        VARCHAR(20) NOT NULL DEFAULT 'ml',
  createdAt     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Un proyecto tiene N bombas.
CREATE TABLE IF NOT EXISTS Bombas (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  serie              VARCHAR(64)  NOT NULL UNIQUE,
  proyectoId         INT          NOT NULL,
  ubicacion          VARCHAR(255),
  productoId         INT NULL,
  estado             ENUM('detenida','programada','infundiendo','pausada','completada')
                     NOT NULL DEFAULT 'detenida',
  caudalMlH          DECIMAL(7,2) NOT NULL DEFAULT 0,
  volumenObjetivoMl  DECIMAL(8,2) NOT NULL DEFAULT 0,
  volumenEntregadoMl DECIMAL(8,2) NOT NULL DEFAULT 0,
  programadaPara     DATETIME NULL,
  iniciadaEn         DATETIME NULL,
  actualizadaEn      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                     ON UPDATE CURRENT_TIMESTAMP,
  -- Estas dos sí son FK: ambas tablas viven en ESTA base.
  CONSTRAINT fk_bomba_proyecto FOREIGN KEY (proyectoId) REFERENCES Proyectos(id),
  CONSTRAINT fk_bomba_producto FOREIGN KEY (productoId) REFERENCES Productos(id),
  INDEX idx_bomba_proyecto (proyectoId),
  INDEX idx_bomba_programada (estado, programadaPara)
);

-- Auditoría de toda acción sobre una bomba.
CREATE TABLE IF NOT EXISTS EventosControl (
  id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  bombaId   INT NOT NULL,
  usuarioId INT NOT NULL,          -- sin FK: el usuario está en la otra base
  accion    ENUM('crear','editar','eliminar','iniciar','pausar','detener','programar') NOT NULL,
  detalle   JSON,
  ts        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_evento_bomba FOREIGN KEY (bombaId) REFERENCES Bombas(id),
  INDEX idx_evento_bomba_ts (bombaId, ts)
);
