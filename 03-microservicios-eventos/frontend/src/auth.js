// Cliente de autenticacion. El frontend conoce UNA sola URL: la del gateway.
// El gateway manda /api/auth/* a auth-service; el frontend no sabe donde vive.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

// Si la puerta devuelve 502 (auth caido) el mensaje viene del gateway.
async function leerJSON(res) {
  try {
    return await res.json();
  } catch {
    return { error: `Error ${res.status} del gateway` };
  }
}

async function pedir(ruta, datos) {
  const res = await fetch(`${API_URL}/auth${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });
  const body = await leerJSON(res);
  if (!res.ok) throw new Error(body.error || 'Error de autenticación');
  return body;
}

export function registrar({ email, password, nombre }) {
  return pedir('/register', { email, password, nombre });
}

// Login: el UNICO momento en que viaja la contraseña.
export async function login({ email, password }) {
  const body = await pedir('/login', { email, password });
  return { accessToken: body.accessToken, refreshToken: body.refreshToken, usuario: body.usuario };
}

// --- Sesion en localStorage --------------------------------------------------
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
  return leerSesion()?.accessToken || null;
}

export function cerrarSesion() {
  localStorage.removeItem(CLAVE);
}

// --- Refresh ------------------------------------------------------------------
// Cambia el refresh guardado por un par nuevo. El viejo queda invalidado en
// auth-db (rotacion), por eso se guarda el nuevo de inmediato.
// Si varias peticiones reciben 401 a la vez, comparten UN solo refresh.
let refrescando = null;

export function refrescarSesion() {
  if (!refrescando) {
    refrescando = (async () => {
      const sesion = leerSesion();
      if (!sesion?.refreshToken) return null;
      try {
        const nueva = await pedir('/refresh', { refreshToken: sesion.refreshToken });
        const actualizada = {
          accessToken: nueva.accessToken,
          refreshToken: nueva.refreshToken,
          usuario: nueva.usuario || sesion.usuario
        };
        guardarSesion(actualizada);
        return actualizada;
      } catch {
        cerrarSesion();
        return null;
      }
    })().finally(() => {
      refrescando = null;
    });
  }
  return refrescando;
}

// --- Logout -------------------------------------------------------------------
// Revoca el refresh en auth-db (si no, seguiria sirviendo 8 h) y borra la sesion.
// Si el access ya vencio, se renueva una vez para poder llamar a /logout.
async function llamarLogout(sesion) {
  return fetch(`${API_URL}/auth/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sesion.accessToken}`
    },
    body: JSON.stringify({ refreshToken: sesion.refreshToken })
  });
}

export async function logout() {
  const sesion = leerSesion();
  try {
    if (sesion?.refreshToken) {
      const res = await llamarLogout(sesion);
      if (res.status === 401) {
        const nueva = await refrescarSesion();
        if (nueva) await llamarLogout(nueva);
      }
    }
  } catch {
    // Si auth no responde igual se cierra la sesion local.
  } finally {
    cerrarSesion();
  }
}

// Al cargar la app: pregunta si el access guardado sirve (/me).
// Si vencio, intenta renovarlo con el refresh. Devuelve el usuario o null.
export async function verificarSesion() {
  if (!leerToken()) return null;
  try {
    let res = await fetch(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${leerToken()}` }
    });
    if (res.status === 401) {
      const nueva = await refrescarSesion();
      if (!nueva) return null;
      res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${nueva.accessToken}` }
      });
    }
    if (!res.ok) return null;
    const body = await res.json();
    return body.usuario;
  } catch {
    return null;
  }
}