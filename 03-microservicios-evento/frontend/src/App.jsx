import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import Registro from './pages/Registro.jsx';
import NuevoProyecto from './pages/NuevoProyecto.jsx';

function leerUsuarioGuardado() {
  try {
    const raw = localStorage.getItem('usuario');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [usuario, setUsuario] = useState(leerUsuarioGuardado);
  const [pantalla, setPantalla] = useState('login');
  const [mensajeLogin, setMensajeLogin] = useState(null);

  useEffect(() => {
  function manejarSesionExpirada() {
    setUsuario(null);
    setPantalla('login');
    setMensajeLogin({ tipo: 'error', texto: 'Tu sesión ha expirado. Inicia sesión nuevamente.' });
  }

  window.addEventListener('sesion-expirada', manejarSesionExpirada);

  return () => {
    window.removeEventListener('sesion-expirada', manejarSesionExpirada);
  };
  }, []);

  function manejarLoginExitoso(respuestaLogin) {
    // Respuesta de /api/auth/login: { accessToken, refreshToken, expiresIn, user }

    localStorage.setItem(
      'usuario',
      JSON.stringify(respuestaLogin.user)
    );

    localStorage.setItem(
      'access_token',
      respuestaLogin.accessToken
    );

    localStorage.setItem(
      'refresh_token',
      respuestaLogin.refreshToken
    );

    setUsuario(respuestaLogin.user);
  }

  function manejarRegistroExitoso(mensaje) {
    setMensajeLogin(mensaje);
    setPantalla('login');
  }

  function cerrarSesion() {
    localStorage.removeItem('usuario');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');

    setUsuario(null);
    setPantalla('login');
  }

  // Sin usuario autenticado: solo se puede ver login o registro.
  // Con usuario autenticado: se pasa a la pantalla de proyectos.
  if (!usuario) {
    return (
      <main>
        {pantalla === 'registro' ? (
          <Registro
            onRegistroExitoso={manejarRegistroExitoso}
            onIrALogin={() => setPantalla('login')}
          />
        ) : (
          <Login
            onLoginExitoso={manejarLoginExitoso}
            onIrARegistro={() => setPantalla('registro')}
            mensajeInicial={mensajeLogin}
          />
        )}
      </main>
    );
  }

  return (
    <main>
      <div className="barra-sesion">
        <span>Sesión iniciada: {usuario.nombre}</span>
        <button type="button" className="link" onClick={cerrarSesion}>
          Cerrar sesión
        </button>
      </div>
      <NuevoProyecto />
    </main>
  );
}
