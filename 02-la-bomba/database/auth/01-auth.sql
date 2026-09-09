-- ═══════════════════════════════════════════════════════════════
--  BASE DE AUTENTICACIÓN
--
--  Solo credenciales. Ningún otro servicio puede leer esta base.
--
--  ¿Por qué separada? Contención de daño: una inyección SQL en el
--  servicio de bombas no debe poder leer hashes de contraseñas.
--  Es la razón por la que los sistemas reales separan identidad
--  aunque el resto del dominio comparta base.
-- ═══════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS autenticacion;
USE autenticacion;

CREATE TABLE IF NOT EXISTS Usuarios (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  email     VARCHAR(255) NOT NULL UNIQUE,
  password  VARCHAR(255) NOT NULL,        -- hash bcrypt, nunca texto plano
  nombre    VARCHAR(255) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Contraseña de ambos: clave123
INSERT INTO Usuarios (id, email, password, nombre) VALUES
  (1, 'ana@hospital.cr',    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Ana Rojas'),
  (2, 'carlos@hospital.cr', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Carlos Mena')
ON DUPLICATE KEY UPDATE email = VALUES(email);

-- ── Principio de menor privilegio ──────────────────────────────
-- El servicio NO se conecta como root. Tiene su propio usuario,
-- con permisos solo sobre lo que necesita.
CREATE USER IF NOT EXISTS 'auth_user'@'%' IDENTIFIED BY 'auth_pass';
GRANT SELECT, INSERT, UPDATE ON autenticacion.Usuarios TO 'auth_user'@'%';
-- Nota: sin DELETE. Dar de baja un usuario debería ser lógico, no físico.
FLUSH PRIVILEGES;
