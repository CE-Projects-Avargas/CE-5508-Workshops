-- auth-service NO entra como root: solo puede leer/escribir sus dos tablas.
CREATE USER IF NOT EXISTS 'auth_user'@'%' IDENTIFIED BY 'auth_pass';
GRANT SELECT, INSERT, UPDATE ON auth.Usuarios      TO 'auth_user'@'%';
GRANT SELECT, INSERT, UPDATE ON auth.RefreshTokens TO 'auth_user'@'%';
FLUSH PRIVILEGES;