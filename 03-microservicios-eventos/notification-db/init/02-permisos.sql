-- notification-service NO entra como root, solo puede leer e insertar notificaciones.
CREATE USER IF NOT EXISTS 'notification_user'@'%' IDENTIFIED BY 'notification_pass';
GRANT SELECT, INSERT ON notificaciones.Notificaciones TO 'notification_user'@'%';
FLUSH PRIVILEGES;
