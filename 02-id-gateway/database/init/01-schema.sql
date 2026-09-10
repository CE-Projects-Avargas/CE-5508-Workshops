-- CE5508 - Taller 2: Identidad y la puerta de entrada
-- Este script se ejecuta automáticamente la primera vez que el contenedor
-- de MariaDB arranca.

USE operacion;

-- Tabla de proyectos (dispositivos médicos de misión crítica) ---------------
CREATE TABLE IF NOT EXISTS Proyectos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  encargado VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipoDispositivo VARCHAR(255),
  criticidad ENUM('bajo', 'medio', 'alto', 'critico') NOT NULL DEFAULT 'medio',
  estado ENUM('planificacion', 'desarrollo', 'pruebas', 'produccion') NOT NULL DEFAULT 'planificacion',
  ownerId INT NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);