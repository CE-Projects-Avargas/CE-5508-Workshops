import { API_URL, cerrarSesion, leerToken, refrescarSesion } from './auth.js';

// Todas las peticiones van al gateway (una sola URL) con el access token.
async function pedirConToken(ruta, opciones = {}) {
  const hacer = () =>
    fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: {
        'Content-Type': 'application/json',
        ...(leerToken() ? { Authorization: `Bearer ${leerToken()}` } : {})
      }
    });

  let res = await hacer();

  // 401: el access vencio (dura 15 min). Se renueva con el refresh y se
  // reintenta UNA vez. Si el refresh tampoco sirve, se vuelve al login.
  if (res.status === 401) {
    const nueva = await refrescarSesion();
    if (!nueva) {
      cerrarSesion();
      window.location.reload();
      throw new Error('Sesión expirada, vuelve a iniciar sesión');
    }
    res = await hacer();
  }

  let body = null;
  try {
    body = res.status === 204 ? null : await res.json();
  } catch {
    body = { error: `Error ${res.status}` };
  }
  // 403: la identidad es valida pero no tiene permiso. NO se cierra sesion.
  if (!res.ok) throw new Error(body?.error || `Error ${res.status}`);
  return body;
}

export function crearProyecto(datos) {
  return pedirConToken('/proyectos', { method: 'POST', body: JSON.stringify(datos) });
}

export function listarProyectos() {
  return pedirConToken('/proyectos');
}

export function eliminarProyecto(id) {
  return pedirConToken(`/proyectos/${id}`, { method: 'DELETE' });
}