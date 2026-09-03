import { useState } from 'react';
import { login, registrar } from '../auth.js';

const ESTADO_INICIAL = { email: '', password: '', nombre: '' };

// Pantalla de login/registro. Habla con el auth-service (puerto 5001).
export default function Login({ onAutenticado }) {
  const [modo, setModo] = useState('login'); // 'login' | 'registro'
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  const esRegistro = modo === 'registro';

  function actualizarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function cambiarModo() {
    setModo(esRegistro ? 'login' : 'registro');
    setMensaje(null);
  }

  async function enviar(e) {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    try {
      if (esRegistro) {
        await registrar(form);
      }
      const sesion = await login({ email: form.email, password: form.password });
      onAutenticado(sesion);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <h1>{esRegistro ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
      <form onSubmit={enviar}>
        {esRegistro && (
          <label>
            Nombre
            <input name="nombre" value={form.nombre} onChange={actualizarCampo} required />
          </label>
        )}
        <label>
          Email
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
          {cargando ? 'Enviando...' : esRegistro ? 'Registrarse' : 'Entrar'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', color: '#94a3b8', fontSize: '0.9rem' }}>
        {esRegistro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
        <button type="button" className="link-button" onClick={cambiarModo}>
          {esRegistro ? 'Inicia sesión' : 'Regístrate'}
        </button>
      </p>
    </>
  );
}
