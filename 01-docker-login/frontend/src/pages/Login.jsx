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
      //Envía las credenciales al auth-service 
      const respuesta = await iniciarSesion(
        email,
        password
      );

      //Guarda el token después de que el login sea exitoso
      localStorage.setItem(
        'token',
        respuesta.token
      );

      //Guarda la información del usuario en el localStorage
      localStorage.setItem(
        'usuario',
        JSON.stringify(respuesta.usuario)
      );


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