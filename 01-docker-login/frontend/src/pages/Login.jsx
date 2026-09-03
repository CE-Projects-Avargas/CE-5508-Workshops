import { useState } from 'react';
import { iniciarSesion } from '../api.js';

const ESTADO_INICIAL = {
  email: '',
  password: ''
};

export default function Login({ onLoginExitoso, onIrARegistro, mensajeInicial }) {
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [mensaje, setMensaje] = useState(mensajeInicial || null);
  const [cargando, setCargando] = useState(false);

  function actualizarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function enviar(e) {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    try {
      const usuario = await iniciarSesion(form);
      onLoginExitoso(usuario);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <h1>Iniciar sesión</h1>
      <form onSubmit={enviar}>
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
          />
        </label>
        {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
        <button type="submit" disabled={cargando}>
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p className="enlace-secundario">
        ¿No tenés cuenta?{' '}
        <button type="button" className="link" onClick={onIrARegistro}>
          Registrate
        </button>
      </p>
    </>
  );
}
