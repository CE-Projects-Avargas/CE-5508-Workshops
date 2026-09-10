const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

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

export async function registrarUsuario(datos) {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Error al registrar usuario');
  return body;
}

export async function iniciarSesion(credenciales) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credenciales)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail || 'Error al iniciar sesión');
  if (!body.authenticated) throw new Error(body.message || 'Correo o contraseña incorrectos');
  return body;
}
