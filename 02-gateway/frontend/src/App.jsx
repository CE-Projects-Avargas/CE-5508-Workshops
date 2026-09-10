import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import NuevoProyecto from './pages/NuevoProyecto.jsx';

export default function App() {
  const [usuario, setUsuario] = useState(null);

  // Al cargar la app, revisa si ya habia una sesion guardada
  useEffect(() => {
    const guardado = localStorage.getItem('usuario');
    if (guardado) setUsuario(JSON.parse(guardado));
  }, []);

  function handleLogin(usuarioLogueado) {
    localStorage.setItem('usuario', JSON.stringify(usuarioLogueado));
    setUsuario(usuarioLogueado);
  }

  function handleLogout() {
    localStorage.removeItem('usuario');
    setUsuario(null);
  }

  // Sin sesion valida, no se pasa a la pantalla de proyectos
  if (!usuario) {
    return (
      <main>
        <Login onLogin={handleLogin} />
      </main>
    );
  }

  return (
    <main>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}
      >
        <span>
          Sesion: <strong>{usuario.nombre}</strong>
        </span>
        <button onClick={handleLogout}>Cerrar sesion</button>
      </div>
      <NuevoProyecto />
    </main>
  );
}