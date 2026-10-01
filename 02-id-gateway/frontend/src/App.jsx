import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import NuevoProyecto from './pages/NuevoProyecto.jsx';
import { cerrarSesion, guardarSesion, leerSesion, logout, verificarSesion } from './auth.js';

export default function App() {
  const [usuario, setUsuario] = useState(() => leerSesion()?.usuario || null);
  const [verificando, setVerificando] = useState(true);

  // Al cargar, valida el access guardado contra auth-service (/api/auth/me).
  // Si venció intenta renovarlo con el refresh; si tampoco sirve, vuelve al login.
  useEffect(() => {
    verificarSesion()
      .then((u) => {
        if (u) {
          setUsuario(u);
        } else {
          cerrarSesion();
          setUsuario(null);
        }
      })
      .finally(() => setVerificando(false));
  }, []);

  function autenticar(sesion) {
    guardarSesion(sesion);
    setUsuario(sesion.usuario);
  }

  // Cerrar sesion revoca el refresh en auth-service, no solo borra localStorage.
  async function salir() {
    await logout();
    setUsuario(null);
  }

  if (verificando) {
    return (
      <main>
        <p>Cargando...</p>
      </main>
    );
  }

  if (!usuario) {
    return (
      <main>
        <Login onAutenticado={autenticar} />
      </main>
    );
  }

  return (
    <main>
      <div className="topbar">
        <span>Sesión: {usuario.nombre}</span>
        <button type="button" className="link-button" onClick={salir}>
          Cerrar sesión
        </button>
      </div>
      <NuevoProyecto usuario={usuario} />
    </main>
  );
}
