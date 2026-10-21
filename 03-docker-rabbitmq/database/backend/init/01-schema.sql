USE backend_db; --Estamos usando la base de datos backend_db, si no existe, se creará automáticamente, no tiene info de la autenticación

CREATE TABLE IF NOT EXISTS Proyectos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  encargado VARCHAR(255) NOT NULL,
  descripcion TEXT,
  tipoDispositivo VARCHAR(255),
  criticidad ENUM('bajo', 'medio', 'alto', 'critico') NOT NULL DEFAULT 'medio',
  estado ENUM('planificacion', 'desarrollo', 'pruebas', 'produccion') NOT NULL DEFAULT 'planificacion',

  ownerId INT, --identificador del usuario que creó el proyecto, para poder filtrar los proyectos por usuario

  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);