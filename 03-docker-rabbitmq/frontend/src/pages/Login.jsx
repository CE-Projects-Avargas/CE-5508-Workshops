import { useState } from 'react';
import { iniciarSesion } from '../authApi.js';


export default function Login({ onLogin, onRegistrar }) {

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');


  async function handleSubmit(event) {

    event.preventDefault();

    setError('');

    try {
      //Solicita el access token y refresh token al servicio de autenticación
      const respuesta = await iniciarSesion(
        email,
        password
      );

      // Guarda el access token y el refresh token
      localStorage.setItem(
        'accessToken',
        respuesta.accessToken
      );

      localStorage.setItem(
        'refreshToken',
        respuesta.refreshToken
      );

      // Guarda cuándo expira el access token
      localStorage.setItem(
        'expiracion',
        (
          Date.now() +
          respuesta.expiresIn * 1000
        ).toString()
      );

      // Guarda la información del usuario
      localStorage.setItem(
        'usuario',
        JSON.stringify(respuesta.usuario)
      );

      // Elimina el token antiguo del Taller 1
      localStorage.removeItem('token');

      onLogin();

    } catch (error) {

      setError(error.message);

    }

  }



  return (
  <div>

    <h1>Iniciar sesión</h1>

    <form onSubmit={handleSubmit}>

      <div>
        <label>Email</label>

        <input
          type="email"
          value={email}
          onChange={(event) =>
            setEmail(event.target.value)
          }
          required
        />
      </div>

      <div>
        <label>Contraseña</label>

        <input
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          required
        />
      </div>

      <button type="submit">
        Iniciar sesión
      </button>

      <button type="button" onClick={onRegistrar}>
        Crear una cuenta
      </button>

    </form>

    {error && (
      <p>{error}</p>
    )}

    

  </div>
);

}