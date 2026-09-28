const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
  * Obtiene el access token almacenado en la sesión actual.
  */

function obtenerAccessToken() {
  return localStorage.getItem('accessToken');
}

/**
  * Construye los headers para una petición autenticada.
  * Si existe un access token, se agrega:
  * Authorization: Bearer <token>
  */
function obtenerHeadersAutenticados() {
  const token = obtenerAccessToken();

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/**
  * Crea un nuevo proyecto.
  * Endpoint protegido: requiere access token.
  */

export async function crearProyecto(datos) {
  const res = await fetch(`${API_URL}/proyectos`, {
    method: 'POST',
    headers: obtenerHeadersAutenticados(),
    body: JSON.stringify(datos)
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || 'Error al crear el proyecto');
  }

  return body;
}

/**
  * Obtiene la lista de proyectos.
  * Endpoint protegido: requiere access token.
  */

export async function listarProyectos() {
  const res = await fetch(`${API_URL}/proyectos`, {
    headers: obtenerHeadersAutenticados()
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || 'Error al listar proyectos');
  }

  return body;
}

/**
  * Registra un nuevo usuario.
  * Endpoint público: no requiere JWT.
*/

export async function registrarUsuario(datos) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const body = await res.json();

  if (!res.ok) throw new Error(body.detail || 'Error al registrar usuario');

  return body;
}

/**
  * Inicia sesión.
  * Endpoint público: no requiere JWT.
  * La respuesta contiene:
  * authenticated
  * access_token
  * refresh_token
  * user
  */

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
