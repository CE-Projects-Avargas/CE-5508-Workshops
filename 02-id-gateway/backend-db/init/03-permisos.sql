-- backend NO entra como root: solo toca la tabla Proyectos.
CREATE USER IF NOT EXISTS 'backend_user'@'%' IDENTIFIED BY 'backend_pass';
GRANT SELECT, INSERT, UPDATE, DELETE ON operacion.Proyectos TO 'backend_user'@'%';
FLUSH PRIVILEGES;