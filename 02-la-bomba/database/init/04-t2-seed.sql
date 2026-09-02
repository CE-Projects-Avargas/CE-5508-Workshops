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

-- Catálogo de productos administrables.
INSERT INTO Productos (id, nombre, concentracion, unidad) VALUES
  (1, 'Solución salina',   '0.9%',     'ml'),
  (2, 'Dextrosa',          '5%',       'ml'),
  (3, 'Heparina',          '100 UI/ml','ml'),
  (4, 'Vancomicina',       '5 mg/ml',  'ml'),
  (5, 'Morfina',           '1 mg/ml',  'ml')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Tres bombas de Ana, dos de Carlos.
INSERT INTO Bombas (serie, proyectoId, ubicacion, productoId, volumenObjetivoMl) VALUES
  ('BIV2-0041', 1, 'Ala Norte · Cama 3',  1, 250),
  ('BIV2-0042', 1, 'Ala Norte · Cama 12', 2, 500),
  ('BIV2-0043', 1, 'Ala Norte · Cama 15', NULL, 0),   -- sin configurar: úsenla para probar el alta
  ('BIV2-0101', 2, 'UCI · Box 1',         3, 100),
  ('BIV2-0102', 2, 'UCI · Box 4',         4, 150)
ON DUPLICATE KEY UPDATE ubicacion = VALUES(ubicacion);
