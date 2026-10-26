// Funciones para consultar proyectos y validar permisos
// mediante el backend principal.

const BACKEND_URL =
  process.env.BACKEND_URL || 'http://backend:4000';

/**
 * Comprueba si el usuario autenticado tiene acceso al proyecto.
 *
 * El backend valida la propiedad del proyecto usando el JWT.
 * Devuelve true si tiene acceso y false si el proyecto no existe
 * o el usuario no tiene permiso para consultarlo.
 *
 * Los errores de comunicación se propagan para evitar conceder
 * acceso cuando no se puede verificar la autorización.
 */
async function usuarioTieneAccesoProyecto(proyectoId, token) {
  const respuesta = await fetch(
    `${BACKEND_URL}/proyectos/${encodeURIComponent(proyectoId)}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    }
  );

  if (respuesta.status === 200) {
    return true;
  }

  if (respuesta.status === 401 || respuesta.status === 403 ||
      respuesta.status === 404) {
    return false;
  }

  throw new Error(
    `El backend no pudo verificar el proyecto (HTTP ${respuesta.status})`
  );
}

module.exports = {
  usuarioTieneAccesoProyecto
};
