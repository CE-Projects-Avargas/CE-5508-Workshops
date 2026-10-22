-- ═══════════════════════════════════════════════════════════════
--  PERMISOS — principio de menor privilegio
--
--  Los dos servicios comparten esta base, pero NO comparten usuario.
--  Cada uno puede hacer exactamente lo que su función necesita.
--
--  Lean los GRANT: son la frontera entre servicios, escrita.
-- ═══════════════════════════════════════════════════════════════

-- ── backend: dueño de los proyectos ────────────────────────────
CREATE USER IF NOT EXISTS 'backend_user'@'%' IDENTIFIED BY 'backend_pass';
GRANT SELECT, INSERT, UPDATE, DELETE ON operacion.Proyectos TO 'backend_user'@'%';
GRANT SELECT                        ON operacion.Bombas    TO 'backend_user'@'%';

-- ── pump-service: dueño de las bombas ──────────────────────────
CREATE USER IF NOT EXISTS 'pump_user'@'%' IDENTIFIED BY 'pump_pass';
GRANT SELECT, INSERT, UPDATE, DELETE ON operacion.Bombas         TO 'pump_user'@'%';
GRANT SELECT, INSERT                 ON operacion.EventosControl TO 'pump_user'@'%';
GRANT SELECT                         ON operacion.Productos      TO 'pump_user'@'%';

-- Este GRANT es deliberado y merece discusión en clase:
-- pump-service PUEDE leer Proyectos, pero no escribirlos.
-- Es lo que hace técnicamente posible la "opción A" del taller.
--
--   Tener el permiso no significa que deban usarlo.
--   ¿Conviene leer la tabla de otro servicio, o pedírsela a él?
GRANT SELECT                         ON operacion.Proyectos      TO 'pump_user'@'%';

-- Nadie tiene DELETE sobre EventosControl: la auditoría no se borra.
FLUSH PRIVILEGES;
