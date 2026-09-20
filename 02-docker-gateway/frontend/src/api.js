const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export async function crearProyecto(datos) {
  const res = await fetch(`${API_URL}/api/proyectos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos)
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || 'Error al crear el proyecto');
  }

  return body;
}

export async function listarProyectos() {
  const res = await fetch(`${API_URL}/api/proyectos`);

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || 'Error al listar proyectos');
  }

  return body;
}

export async function login(email, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password
    })
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(body.error || 'Error al iniciar sesión');
  }

  return body;
}