-- CE5508 · Taller 2 — Precarga
--
-- IMPORTANTE: hay DOS usuarios con proyectos distintos a propósito.
-- Sin eso, la propiedad de datos no se puede demostrar ni evaluar.
--
-- Contraseña de ambos: clave123
-- (hash bcrypt, coste 10 — el mismo que produce bcrypt.hash('clave123', 10))

USE dispositivos_medicos;

INSERT INTO Usuarios (id, email, password, nombre) VALUES
  (1, 'ana@hospital.cr',    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Ana Rojas'),
  (2, 'carlos@hospital.cr', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Carlos Mena')
ON DUPLICATE KEY UPDATE email = VALUES(email);

INSERT INTO Proyectos (id, nombre, encargado, descripcion, tipoDispositivo, criticidad, estado, ownerId) VALUES
  (1, 'Bombas Ala Norte', 'Ana Rojas',   'Bombas de infusión del ala norte.', 'Bomba de infusión', 'alto',    'produccion', 1),
  (2, 'Bombas UCI',       'Carlos Mena', 'Bombas de la unidad de cuidados intensivos.', 'Bomba de infusión', 'critico', 'produccion', 2)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Tres bombas de Ana, dos de Carlos.
INSERT INTO Bombas (serie, proyectoId, ubicacion) VALUES
  ('BIV2-0041', 1, 'Ala Norte · Cama 3'),
  ('BIV2-0042', 1, 'Ala Norte · Cama 12'),
  ('BIV2-0043', 1, 'Ala Norte · Cama 15'),
  ('BIV2-0101', 2, 'UCI · Box 1'),
  ('BIV2-0102', 2, 'UCI · Box 4')
ON DUPLICATE KEY UPDATE ubicacion = VALUES(ubicacion);
