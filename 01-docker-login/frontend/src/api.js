const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

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
