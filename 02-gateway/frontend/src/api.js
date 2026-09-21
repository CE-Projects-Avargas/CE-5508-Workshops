//const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
//const AUTH_URL = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:5001';
const GATEWAY_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

function obtenerAccessToken() {
  try {
    const sesion = JSON.parse(localStorage.getItem('sesion'));
    return sesion?.accessToken;
  } catch {
    return null;
  }
}

function headersAutenticados(headers = {}) {
  const accessToken = obtenerAccessToken();
  return {
    ...headers,
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
  };
}

export async function crearProyecto(datos) {
  const res = await fetch(`${GATEWAY_URL}/proyectos`, {
    method: 'POST',
    headers: headersAutenticados({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(datos)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error al crear el proyecto');
  return body;
}

export async function listarProyectos() {
  const res = await fetch(`${GATEWAY_URL}/proyectos`, {
    headers: headersAutenticados()
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error al listar proyectos');
  return body;
}

export async function login(datos) {
  const res = await fetch(`${GATEWAY_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Credenciales incorrectas');
  return body; // { mensaje, usuario: { id, nombre, email } }
}

export async function registrar(datos) {
  const res = await fetch(`${GATEWAY_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'No se pudo registrar el usuario');
  return body; // { mensaje, usuario: { id, nombre, email } }
}
