USE auth;
INSERT INTO Usuarios (id, email, password, nombre) VALUES
  (1, 'ana@hospital.cr',    'scrypt:32768:8:1$hyLrn1lBsYVCpNyp$d797e9f4f05e7655f1af3f601fa99f0b67b2100912923f97f3b521e51d8ba09078977bcfdf0affb74eddb369aaa35f4a81dc8f5eab6533292205168fae4afe4f', 'Ana Rojas'),
  (2, 'carlos@hospital.cr', 'scrypt:32768:8:1$hyLrn1lBsYVCpNyp$d797e9f4f05e7655f1af3f601fa99f0b67b2100912923f97f3b521e51d8ba09078977bcfdf0affb74eddb369aaa35f4a81dc8f5eab6533292205168fae4afe4f', 'Carlos Mena')
ON DUPLICATE KEY UPDATE email = VALUES(email);