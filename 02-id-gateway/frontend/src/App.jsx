import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import NuevoProyecto from './pages/NuevoProyecto.jsx';
import { cerrarSesion, guardarSesion, leerSesion, verificarSesion } from './auth.js';

export default function App() {
  const [usuario, setUsuario] = useState(() => leerSesion()?.usuario || null);
  const [verificando, setVerificando] = useState(true);

  // Al cargar, valida el JWT guardado contra el auth-service (/me).
  // Si expiró o no es válido, se limpia la sesión y vuelve al login.
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

  function salir() {
    cerrarSesion();
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
      <NuevoProyecto />
    </main>
  );
}
