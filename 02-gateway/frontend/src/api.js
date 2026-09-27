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

// Si llegan varias peticiones con 401 al mismo tiempo, todas esperan
// la misma renovacion. Si cada una llamara a /auth/refresh por su cuenta,
// la segunda usaria un refresh ya rotado y cerraria la sesion.
let renovacionEnCurso = null;

function renovarSesion() {
  if (!renovacionEnCurso) {
    renovacionEnCurso = (async () => {
      const sesion = JSON.parse(localStorage.getItem('sesion'));
      if (!sesion?.refreshToken) throw new Error('No hay refresh token');

      const res = await fetch(`${GATEWAY_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: sesion.refreshToken })
      });
      if (!res.ok) throw new Error('No se pudo renovar la sesion');

      const { accessToken, refreshToken, expiresIn } = await res.json();
      localStorage.setItem('sesion', JSON.stringify({
        ...sesion,
        accessToken,
        refreshToken,
        expiresIn,
        expiresAt: Date.now() + expiresIn * 1000
      }));
    })().finally(() => {
      renovacionEnCurso = null;
    });
  }
  return renovacionEnCurso;
}

// fetch con el access token. Ante un 401 renueva los tokens una vez y
// reintenta; si la renovacion falla, avisa a App.jsx para volver al login.
async function fetchAutenticado(url, opciones = {}) {
  const hacerPeticion = () =>
    fetch(url, { ...opciones, headers: headersAutenticados(opciones.headers) });

  const res = await hacerPeticion();
  if (res.status !== 401) return res;

  try {
    await renovarSesion();
  } catch {
    localStorage.removeItem('sesion');
    window.dispatchEvent(new Event('sesion-expirada'));
    throw new Error('La sesion expiro, inicie sesion de nuevo');
  }
  return hacerPeticion();
}

export async function crearProyecto(datos) {
  const res = await fetchAutenticado(`${GATEWAY_URL}/proyectos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || 'Error al crear el proyecto');
  return body;
}

export async function listarProyectos() {
  const res = await fetchAutenticado(`${GATEWAY_URL}/proyectos`);
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
