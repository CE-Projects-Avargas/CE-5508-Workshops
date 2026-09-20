-- Datos de ejemplo para backend-db

USE backend_db;

INSERT INTO Proyectos (
  nombre,
  encargado,
  descripcion,
  tipoDispositivo,
  criticidad,
  estado
)
VALUES
  (
    'Monitor Cardiaco Portatil V2',
    'Ana Rojas',
    'Monitor de signos vitales portatil para pacientes ambulatorios.',
    'Monitor',
    'alto',
    'desarrollo'
  ),
  (
    'Bomba de Infusion Inteligente',
    'Carlos Mena',
    'Bomba de infusion con dosificacion automatica y alertas.',
    'Bomba de infusion',
    'critico',
    'pruebas'
  ),
  (
    'Ventilador de Emergencia',
    'Laura Vindas',
    'Ventilador mecanico compacto para unidades moviles.',
    'Ventilador',
    'critico',
    'planificacion'
  );