const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const AUTH_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:5001';

export async function crearProyecto(datos) {
  const res = await fetch(`${API_URL}/proyectos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error al crear el proyecto');
  return body;
}

export async function listarProyectos() {
  const res = await fetch(`${API_URL}/proyectos`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error al listar proyectos');
  return body;
}

export async function login(datos) {
  const res = await fetch(`${AUTH_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Credenciales incorrectas');
  return body; // { mensaje, usuario: { id, nombre, email } }
}

export async function registrar(datos) {
  const res = await fetch(`${AUTH_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'No se pudo registrar el usuario');
  return body; // { mensaje, usuario: { id, nombre, email } }
}
