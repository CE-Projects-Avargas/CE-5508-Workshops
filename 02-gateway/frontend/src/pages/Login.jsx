import { useState } from 'react';
import { login, registrar } from '../api.js';

const LOGIN_INICIAL = { email: '', password: '' };
const REGISTRO_INICIAL = { nombre: '', email: '', password: '' };

// onLogin recibe el objeto usuario devuelto por el auth-service
// y le avisa a App.jsx que ya hay sesion.
export default function Login({ onLogin }) {
  const [modo, setModo] = useState('login'); // 'login' | 'registro'
  const [formLogin, setFormLogin] = useState(LOGIN_INICIAL);
  const [formRegistro, setFormRegistro] = useState(REGISTRO_INICIAL);
  const [mensaje, setMensaje] = useState(null);
  const [cargando, setCargando] = useState(false);

  function actualizarLogin(e) {
    setFormLogin({ ...formLogin, [e.target.name]: e.target.value });
  }

  function actualizarRegistro(e) {
    setFormRegistro({ ...formRegistro, [e.target.name]: e.target.value });
  }

  async function enviarLogin(e) {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    try {
      const { usuario } = await login(formLogin);
      onLogin(usuario);
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }

  async function enviarRegistro(e) {
    e.preventDefault();
    setCargando(true);
    setMensaje(null);
    try {
      await registrar(formRegistro);
      setMensaje({ tipo: 'exito', texto: 'Cuenta creada. Ahora inicia sesion.' });
      setFormRegistro(REGISTRO_INICIAL);
      setModo('login');
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      <h1>{modo === 'login' ? 'Iniciar sesion' : 'Crear cuenta'}</h1>

      {modo === 'login' ? (
        <form onSubmit={enviarLogin}>
          <label>
            Email
            <input
              type="email"
              name="email"
              value={formLogin.email}
              onChange={actualizarLogin}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              value={formLogin.password}
              onChange={actualizarLogin}
              required
            />
          </label>
          {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
          <button type="submit" disabled={cargando}>
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      ) : (
        <form onSubmit={enviarRegistro}>
          <label>
            Nombre
            <input
              name="nombre"
              value={formRegistro.nombre}
              onChange={actualizarRegistro}
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              name="email"
              value={formRegistro.email}
              onChange={actualizarRegistro}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              name="password"
              value={formRegistro.password}
              onChange={actualizarRegistro}
              required
            />
          </label>
          {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
          <button type="submit" disabled={cargando}>
            {cargando ? 'Creando...' : 'Crear cuenta'}
          </button>
        </form>
      )}

      <p style={{ marginTop: '1rem' }}>
        {modo === 'login' ? (
          <>
            No tienes cuenta?{' '}
            <button
              type="button"
              onClick={() => {
                setModo('registro');
                setMensaje(null);
              }}
            >
              Crear una
            </button>
          </>
        ) : (
          <>
            Ya tienes cuenta?{' '}
            <button
              type="button"
              onClick={() => {
                setModo('login');
                setMensaje(null);
              }}
            >
              Iniciar sesion
            </button>
          </>
        )}
      </p>
    </>
  );
}
