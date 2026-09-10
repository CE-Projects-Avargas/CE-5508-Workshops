-- CE5508 - Taller 2: Identidad y la puerta de entrada
-- Base de datos exclusiva de auth-service. Ningun otro servicio se conecta aqui.
-- Se ejecuta automaticamente la primera vez que este contenedor de MariaDB arranca.

USE auth;

CREATE TABLE IF NOT EXISTS Usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);