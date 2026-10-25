-- Base EXCLUSIVA de auth-service. Guarda solo usuarios y refresh tokens.
CREATE DATABASE IF NOT EXISTS auth;
USE auth;

CREATE TABLE IF NOT EXISTS Usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nombre VARCHAR(255) NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Se guarda el HASH del refresh token, nunca el token en claro.
-- revocadoEn con valor = ese refresh ya se usó y no sirve más.
CREATE TABLE IF NOT EXISTS RefreshTokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usuarioId INT NOT NULL,
  tokenHash CHAR(64) NOT NULL UNIQUE,
  expiraEn DATETIME NOT NULL,
  revocadoEn DATETIME NULL,
  motivo ENUM('rotado', 'logout', 'reuso') NULL,   -- por que se revoco
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_usuario FOREIGN KEY (usuarioId) REFERENCES Usuarios(id)
);