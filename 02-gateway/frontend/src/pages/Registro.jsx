import { useState } from 'react';
import { registrarUsuario } from '../api.js';

const ESTADO_INICIAL = {
  nombre: '',
  email: '',
  password: ''
};

export default function Registro({ onRegistroExitoso, onIrALogin }) {
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  function actualizarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function enviar(e) {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    try {
      await registrarUsuario(form);
      onRegistroExitoso({
        tipo: 'exito',
        texto: 'Cuenta creada correctamente. Iniciá sesión.'
      });
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <h1>Crear cuenta</h1>
      <form onSubmit={enviar}>
        <label>
          Nombre
          <input
            name="nombre"
            value={form.nombre}
            onChange={actualizarCampo}
            required
          />
        </label>
        <label>
          Correo
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={actualizarCampo}
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={actualizarCampo}
            required
            minLength={6}
          />
        </label>
        {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
        <button type="submit" disabled={cargando}>
          {cargando ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>
      <p className="enlace-secundario">
        ¿Ya tenés cuenta?{' '}
        <button type="button" className="link" onClick={onIrALogin}>
          Iniciá sesión
        </button>
      </p>
    </>
  );
}
