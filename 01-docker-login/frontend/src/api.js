import { cerrarSesion, leerToken } from './auth.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// Cabeceras con el JWT del auth-service, si hay sesión.
function cabeceras() {
  const h = { 'Content-Type': 'application/json' };
  const token = leerToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

// El backend responde 401 si el token falta o expiró: cerramos sesión
// y recargamos para volver al login.
function siExpiro(res) {
  if (res.status === 401) {
    cerrarSesion();
    window.location.reload();
    throw new Error('Sesión expirada, vuelve a iniciar sesión');
  }
}

export async function crearProyecto(datos) {
  const res = await fetch(`${API_URL}/proyectos`, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify(datos)
  });
  siExpiro(res);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error al crear el proyecto');
  return body;
}

export async function listarProyectos() {
  const res = await fetch(`${API_URL}/proyectos`, { headers: cabeceras() });
  siExpiro(res);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error al listar proyectos');
  return body;
}
