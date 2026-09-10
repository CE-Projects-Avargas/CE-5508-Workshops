USE operacion;

-- ownerId 1 = Ana, 2 = Carlos (viven en la base de autenticación).
-- Dos dueños distintos a propósito: sin eso la propiedad de datos
-- no se puede demostrar ni evaluar.
INSERT INTO Proyectos (id, nombre, encargado, descripcion, tipoDispositivo, criticidad, estado, ownerId) VALUES
  (1, 'Bombas Ala Norte', 'Ana Rojas',   'Bombas de infusión del ala norte.',            'Bomba de infusión', 'alto',    'produccion', 1),
  (2, 'Bombas UCI',       'Carlos Mena', 'Bombas de la unidad de cuidados intensivos.',  'Bomba de infusión', 'critico', 'produccion', 2)
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

INSERT INTO Productos (id, nombre, concentracion, unidad) VALUES
  (1, 'Solución salina', '0.9%',      'ml'),
  (2, 'Dextrosa',        '5%',        'ml'),
  (3, 'Heparina',        '100 UI/ml', 'ml'),
  (4, 'Vancomicina',     '5 mg/ml',   'ml'),
  (5, 'Morfina',         '1 mg/ml',   'ml')
ON DUPLICATE KEY UPDATE nombre = VALUES(nombre);

-- Tres bombas de Ana, dos de Carlos. La BIV2-0043 va sin configurar
-- a propósito: úsenla para probar el alta y la edición.
INSERT INTO Bombas (serie, proyectoId, ubicacion, productoId, volumenObjetivoMl) VALUES
  ('BIV2-0041', 1, 'Ala Norte · Cama 3',  1,    250),
  ('BIV2-0042', 1, 'Ala Norte · Cama 12', 2,    500),
  ('BIV2-0043', 1, 'Ala Norte · Cama 15', NULL,   0),
  ('BIV2-0101', 2, 'UCI · Box 1',         3,    100),
  ('BIV2-0102', 2, 'UCI · Box 4',         4,    150)
ON DUPLICATE KEY UPDATE ubicacion = VALUES(ubicacion);
