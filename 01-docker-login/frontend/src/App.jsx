import { useState } from 'react';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NuevoProyecto from './pages/NuevoProyecto.jsx';

export default function App() {
  //Revisa si hay un token en el localStorage para determinar si el usuario está autenticado
  const [autenticado, setAutenticado] = useState(
    Boolean(localStorage.getItem('token'))
  );
 //Controla si se muesytra la pantalla de login o la de registro
  const [pantalla, setPantalla] = useState('login');

  //Ya elimina los datos del usuario y el token del localStorage y cambia la pantalla a login
  function cerrarSesion() {

    localStorage.removeItem('token');
    localStorage.removeItem('usuario');

    setAutenticado(false);
    setPantalla('login');

  }

  if (autenticado) {

    return (
      <main>

        <button onClick={cerrarSesion}>
          Cerrar sesión
        </button>

        <NuevoProyecto />

      </main>
    );

  }

  if (pantalla === 'registro') {

    return (
      <main>

        <Register
          onVolverLogin={() =>
            setPantalla('login')
          }
        />

      </main>
    );

  }

  return (
    <main>

      <Login
        onLogin={() =>
          setAutenticado(true)
        }

        onRegistrar={() =>{
          console.log('Cambiar a registro');
          setPantalla('registro');
        }}
      />

    </main>
  );
}