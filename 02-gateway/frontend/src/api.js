const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';

/**
  * Obtiene el access token almacenado en la sesión actual.
  */
function obtenerAccessToken() {
  return localStorage.getItem('access_token');
}

function guardarTokens(accessToken, refreshToken) {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
}

function eliminarSesion() {
  localStorage.removeItem('usuario');
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');

  window.dispatchEvent(new Event('sesion-expirada'));
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

async function refrescarTokens() {
  const refreshToken = localStorage.getItem('refresh_token');

  if (!refreshToken) {
    eliminarSesion();
    throw new Error('No existe un refresh token');
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      refresh_token: refreshToken
    })
  });

  const body = await res.json();

  if (!res.ok) {
    eliminarSesion();
    throw new Error(
      body.detail || body.error || 'La sesión ha expirado'
    );
  }

  guardarTokens(
    body.access_token,
    body.refresh_token
  );

  return body;
}

let refreshEnProgreso = null;

async function fetchAutenticado(url, opciones = {}) {
  const opcionesIniciales = {
    ...opciones,
    headers: {
      ...obtenerHeadersAutenticados(),
      ...(opciones.headers || {})
    }
  };

  let res = await fetch(url, opcionesIniciales);

  if (res.status !== 401) {
    return res;
  }

  try {
    if (!refreshEnProgreso) {
      refreshEnProgreso = refrescarTokens()
        .finally(() => {
          refreshEnProgreso = null;
        });
    }

    await refreshEnProgreso;
  } catch {
    throw new Error(
      'La sesión ha expirado. Inicie sesión nuevamente.'
    );
  }

  const opcionesReintento = {
    ...opciones,
    headers: {
      ...obtenerHeadersAutenticados(),
      ...(opciones.headers || {})
    }
  };

  return fetch(url, opcionesReintento);
}

/**
  * Crea un nuevo proyecto.
  * Endpoint protegido: requiere access token.
  */
export async function crearProyecto(datos) {
  const res = await fetchAutenticado(`${API_URL}/proyectos`, {
    method: 'POST',
    body: JSON.stringify(datos)
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || body.detail || 'Error al crear el proyecto');
  }

  return body;
}

/**
  * Obtiene la lista de proyectos.
  * Endpoint protegido: requiere access token.
  */
export async function listarProyectos() {
  const res = await fetchAutenticado(`${API_URL}/proyectos`, {
    method: 'GET'
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || body.detail || 'Error al listar proyectos');
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

export async function listarBombas(proyectoId) {
  const res = await fetchAutenticado(
    `${API_URL}/bombas?proyectoId=${proyectoId}`
  );

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.detail || body.error || 'Error al listar bombas'
    );
  }

  return body;
}

export async function obtenerBomba(id) {
  const res = await fetchAutenticado(`${API_URL}/bombas/${id}`, {
    method: 'GET'
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error || body.detail || 'Error al obtener la bomba'
    );
  }

  return body;
}

export async function crearBomba(datos) {
  const res = await fetchAutenticado(`${API_URL}/bombas`, {
    method: 'POST',
    body: JSON.stringify(datos)
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error || body.detail || 'Error al crear la bomba'
    );
  }

  return body;
}

export async function editarBomba(id, datos) {
  const res = await fetchAutenticado(`${API_URL}/bombas/${id}`, {
    method: 'PUT',
    body: JSON.stringify(datos)
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error || body.detail || 'Error al editar la bomba'
    );
  }

  return body;
}

export async function eliminarBomba(id) {
  const res = await fetchAutenticado(`${API_URL}/bombas/${id}`, {
    method: 'DELETE'
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error || body.detail || 'Error al eliminar la bomba'
    );
  }

  return body;
}

export async function iniciarBomba(id, datos) {
  const res = await fetchAutenticado(
    `${API_URL}/bombas/${id}/iniciar`,
    {
      method: 'POST',
      body: JSON.stringify(datos)
    }
  );

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error || body.detail || 'Error al iniciar la bomba'
    );
  }

  return body;
}

export async function programarBomba(id, datos) {
  const res = await fetchAutenticado(
    `${API_URL}/bombas/${id}/programar`,
    {
      method: 'POST',
      body: JSON.stringify(datos)
    }
  );

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error || body.detail || 'Error al programar la bomba'
    );
  }

  return body;
}

export async function pausarBomba(id) {
  const res = await fetchAutenticado(
    `${API_URL}/bombas/${id}/pausar`,
    {
      method: 'POST'
    }
  );

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error || body.detail || 'Error al pausar la bomba'
    );
  }

  return body;
}

export async function detenerBomba(id) {
  const res = await fetchAutenticado(
    `${API_URL}/bombas/${id}/detener`,
    {
      method: 'POST'
    }
  );

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error || body.detail || 'Error al detener la bomba'
    );
  }

  return body;
}

export async function listarProductos() {
  const res = await fetchAutenticado(`${API_URL}/productos`, {
    method: 'GET'
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(
      body.error || body.detail || 'Error al listar los productos'
    );
  }

  return body;
}
