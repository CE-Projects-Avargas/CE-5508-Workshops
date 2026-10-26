--  Nunca se guarda el refresh token en texto plano, solo su hash
--  (sha256). Si alguien lee esta tabla, no puede autenticarse con lo que ve tendria que revertir el hash.

USE autenticacion;

CREATE TABLE IF NOT EXISTS RefreshTokens (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  usuario_id  INT NOT NULL,
  token_hash  VARCHAR(64) NOT NULL UNIQUE,
  expires_at  DATETIME NOT NULL,
  revoked_at  DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES Usuarios(id)
);

-- Mismo principio que 01-auth.sql: sin DELETE. Un refresh usado o
-- vencido se marca (revoked_at), no se borra y deja rastro para
-- auditoria de sesiones.
GRANT SELECT, INSERT, UPDATE ON autenticacion.RefreshTokens TO 'auth_user'@'%';
FLUSH PRIVILEGES;