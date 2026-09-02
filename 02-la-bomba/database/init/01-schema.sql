-- CE5508 - Taller Docker + Login
-- Este script se ejecuta automáticamente la primera vez que el contenedor
-- de MariaDB arranca (Docker monta todo /database/init dentro de
-- /docker-entrypoint-initdb.d, y MariaDB corre cada .sql en orden alfabético).

USE dispositivos_medicos;

-- Tabla de usuarios (para login) --------------------------------------------
CREATE TABLE IF NOT EXISTS Usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de proyectos (dispositivos médicos de misión crítica) ---------------
CREATE TABLE IF NOT EXISTS Proyectos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  encargado VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipoDispositivo VARCHAR(255),
  criticidad ENUM('bajo', 'medio', 'alto', 'critico') NOT NULL DEFAULT 'medio',
  estado ENUM('planificacion', 'desarrollo', 'pruebas', 'produccion') NOT NULL DEFAULT 'planificacion',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
