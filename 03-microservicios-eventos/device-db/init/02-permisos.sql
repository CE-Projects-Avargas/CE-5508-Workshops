-- device-service NO entra como root, solo puede leer e insertar en sus dos tablas.
CREATE USER IF NOT EXISTS 'device_user'@'%' IDENTIFIED BY 'device_pass';
GRANT SELECT, INSERT ON dispositivos.Devices TO 'device_user'@'%';
GRANT SELECT, INSERT ON dispositivos.Alerts TO 'device_user'@'%';
FLUSH PRIVILEGES;