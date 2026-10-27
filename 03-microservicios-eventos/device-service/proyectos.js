// Consulta a backend quien es el dueno de un proyecto.
//
// Los proyectos viven en backend-db, que device-service no alcanza (otra red).
// Para un dispositivo de proyecto, device-service le pregunta a backend por
// HTTP en la red "interna", reenviando el MISMO token del usuario: backend lo
// verifica por su cuenta, igual que cualquier otra peticion.
//
// Es una consulta sincronica a proposito: para decidir 403 o 200 hace falta la
// respuesta ahora. Los eventos (lo que si se desacopla) van por RabbitMQ.
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:4000';

// Devuelve el ownerId del proyecto, o null si el proyecto no existe.
// Si backend no responde lanza un error con status 503.
async function duenoDelProyecto(projectId, authorization) {
  let res;
  try {
    res = await fetch(`${BACKEND_URL}/proyectos/${projectId}`, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(3000)
    });
  } catch {
    throw Object.assign(new Error('backend no disponible para validar el proyecto'), { status: 503 });
  }

  if (res.status === 404) return null;
  if (!res.ok) {
    throw Object.assign(new Error(`backend respondio ${res.status} al validar el proyecto`), { status: 503 });
  }
  const proyecto = await res.json();
  return proyecto.ownerId;
}

// Ids de los proyectos de los que el usuario es dueno.
async function proyectosDe(userId, authorization) {
  let res;
  try {
    res = await fetch(`${BACKEND_URL}/proyectos`, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(3000)
    });
  } catch {
    throw Object.assign(new Error('backend no disponible para listar proyectos'), { status: 503 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`backend respondio ${res.status} al listar proyectos`), { status: 503 });
  }
  const proyectos = await res.json();
  return proyectos.filter((p) => p.ownerId === userId).map((p) => p.id);
}

module.exports = { duenoDelProyecto, proyectosDe };
