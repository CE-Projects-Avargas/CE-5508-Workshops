-- Datos de ejemplo, opcionales — para que GET /proyectos ya muestre algo
-- desde el primer arranque, sin tener que crear nada manualmente.

USE dispositivos_medicos;

INSERT INTO Proyectos (nombre, encargado, descripcion, tipoDispositivo, criticidad, estado)
VALUES
  ('Monitor Cardiaco Portatil V2', 'Ana Rojas', 'Monitor de signos vitales portatil para pacientes ambulatorios.', 'Monitor', 'alto', 'desarrollo'),
  ('Bomba de Infusion Inteligente', 'Carlos Mena', 'Bomba de infusion con dosificacion automatica y alertas.', 'Bomba de infusion', 'critico', 'pruebas'),
  ('Ventilador de Emergencia', 'Laura Vindas', 'Ventilador mecanico compacto para unidades moviles.', 'Ventilador', 'critico', 'planificacion');
