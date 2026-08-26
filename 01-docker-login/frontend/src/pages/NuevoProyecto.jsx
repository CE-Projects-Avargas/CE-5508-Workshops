import { useEffect, useState } from 'react';
import { crearProyecto, listarProyectos } from '../api.js';

const ESTADO_INICIAL = {
  nombre: '',
  encargado: ''
};

// Esta pantalla ya funciona completo — es tu ejemplo de referencia
// de cómo el frontend consume el backend con fetch. El patrón para
// /auth/login en Login.jsx es el mismo: fetch + manejo de respuesta.
export default function NuevoProyecto() {
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [proyectos, setProyectos] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  async function cargarProyectos() {
    try {
      setProyectos(await listarProyectos());
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  }

  useEffect(() => {
    cargarProyectos();
  }, []);

  function actualizarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function enviar(e) {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    try {
      await crearProyecto(form);
      setMensaje({ tipo: 'exito', texto: 'Proyecto creado correctamente' });
      setForm(ESTADO_INICIAL);
      await cargarProyectos();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <h1>Nuevo proyecto (dispositivo médico)</h1>
      <form onSubmit={enviar}>
        <label>
          Nombre
          <input name="nombre" value={form.nombre} onChange={actualizarCampo} required />
        </label>
        <label>
          Encargado
          <input name="encargado" value={form.encargado} onChange={actualizarCampo} required />
        </label>
        {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
        <button type="submit" disabled={cargando}>
          {cargando ? 'Creando...' : 'Crear proyecto'}
        </button>
      </form>

      <h1 style={{ marginTop: '2rem' }}>Proyectos existentes</h1>
      {proyectos.length === 0 && <p>No hay proyectos todavía.</p>}
      {proyectos.map((p) => (
        <div className="proyecto-card" key={p.id}>
          <h3>{p.nombre}</h3>
          <span className="badge">{p.criticidad}</span>
          <span className="badge">{p.estado}</span>
          <p>{p.descripcion}</p>
          <small>Encargado: {p.encargado}</small>
        </div>
      ))}
    </>
  );
}
