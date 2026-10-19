USE auth_db; --Estamos usando la base de datos auth_db, si no existe, se creará automáticamente

--Tiene los hashes de los refresh tokens emitidos a los usuarios, para poder revocarlos sin almacenar el token en texto plano.
CREATE TABLE IF NOT EXISTS RefreshTokens (
    id INT AUTO_INCREMENT PRIMARY KEY,

    usuario_id INT NOT NULL,

    token_hash CHAR(64) NOT NULL UNIQUE,

    expires_at DATETIME NOT NULL,

    --Se puede usar para revocar un refresh token antes de su fecha de expiración(si el usuario cierra sesión o cambia su contraseña.)
    revoked_at DATETIME DEFAULT NULL,

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    --Los refresh tokens desaparecen si se elimina el usuario
    FOREIGN KEY (usuario_id)
        REFERENCES Usuarios(id)
        ON DELETE CASCADE
);
