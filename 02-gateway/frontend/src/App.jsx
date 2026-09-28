import { useState } from 'react';
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

  function manejarLoginExitoso(usuarioAutenticado) {
    /**
     * La respuesta del auth-service tiene la siguiente estructura:
     *
     * {
     * authenticated: true,
     * message: "Login exitoso",
     * access_token: "...",
     * refresh_token: "...",
     * user: {
     * id: ...,
     * email: "...",
     * nombre: "..."
     * }
     * }
    */
  
    localStorage.setItem('usuario', JSON.stringify(usuarioAutenticado.usuario));
    localStorage.setItem('accessToken', usuarioAutenticado.accessToken);
    localStorage.setItem('refreshToken', usuarioAutenticado.refreshToken);

    setUsuario(usuarioAutenticado.usuario);
  }

  function manejarRegistroExitoso(mensaje) {
    setMensajeLogin(mensaje);
    setPantalla('login');
  }

  function cerrarSesion() {
    localStorage.removeItem('usuario');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

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
