// Cliente del auth-service (contenedor Flask, separado del backend de /proyectos).
const AUTH_URL = import.meta.env.VITE_AUTH_URL || 'http://localhost:5001';

async function pedir(ruta, datos) {
  const res = await fetch(`${AUTH_URL}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error de autenticación');
  return body;
}

export function registrar({ email, password, nombre }) {
  return pedir('/register', { email, password, nombre });
}

export async function login({ email, password }) {
  const body = await pedir('/login', { email, password });
  return { token: body.token, usuario: body.usuario };
}

// La sesión ({ token, usuario }) se guarda en localStorage para sobrevivir recargas.
const CLAVE = 'ce5508_sesion';

export function guardarSesion(sesion) {
  localStorage.setItem(CLAVE, JSON.stringify(sesion));
}

export function leerSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE)) || null;
  } catch {
    return null;
  }
}

export function leerToken() {
  return leerSesion()?.token || null;
}

export function cerrarSesion() {
  localStorage.removeItem(CLAVE);
}

// Pregunta al auth-service si el JWT guardado sigue siendo válido.
// Devuelve el usuario del token, o null si no hay token o expiró.
export async function verificarSesion() {
  const token = leerToken();
  if (!token) return null;
  try {
    const res = await fetch(`${AUTH_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.usuario;
  } catch {
    return null;
  }
}
