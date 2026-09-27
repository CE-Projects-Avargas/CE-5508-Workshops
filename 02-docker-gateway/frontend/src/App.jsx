import { useEffect, useState } from 'react';

import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NuevoProyecto from './pages/NuevoProyecto.jsx';


export default function App() {
  //Considera iniciada la sesión mientras exista un refresh token
  const [autenticado, setAutenticado] = useState(
    Boolean(localStorage.getItem('refreshToken'))
  );

  const [pantalla, setPantalla] = useState('login');


  // Elimina las credenciales y regresa al login
  function cerrarSesion() {

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('expiracion');
    localStorage.removeItem('usuario');

    // Token utilizado en el Taller 1
    localStorage.removeItem('token');

    setAutenticado(false);
    setPantalla('login');

  }


  // Permite cerrar la sesión cuando falla la renovación
  useEffect(() => {

    function manejarSesionExpirada() {
      cerrarSesion();
    }

    window.addEventListener(
      'sesion-expirada',
      manejarSesionExpirada
    );

    return () => {

      window.removeEventListener(
        'sesion-expirada',
        manejarSesionExpirada
      );

    };

  }, []);


  if (autenticado) {

    return (

      <main>

        <button
          type="button"
          onClick={cerrarSesion}
        >
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

        onRegistrar={() =>
          setPantalla('registro')
        }

      />

    </main>

  );

}