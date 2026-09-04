import { useState } from 'react';
import { registrarUsuario } from '../authApi.js';

export default function Register({ onVolverLogin }) {

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');

  async function handleSubmit(event) {

    event.preventDefault();

    setError('');
    setMensaje('');

    try {
      // Envía los datos del formulario al endpoint /register
      await registrarUsuario(
        nombre,
        email,
        password
      );

      setMensaje(
        'Usuario registrado correctamente'
      );

      setNombre('');
      setEmail('');
      setPassword('');

    } catch (error) {

      setError(error.message);

    }

  }

  return (
    <div>

      <h1>Registrar usuario</h1>

      <form onSubmit={handleSubmit}>

        <div>
          <label>Nombre</label>

          <input
            type="text"
            value={nombre}
            onChange={(event) =>
              setNombre(event.target.value)
            }
            required
          />
        </div>

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
          Registrarse
        </button>

      </form>

      {mensaje && (
        <p>{mensaje}</p>
      )}

      {error && (
        <p>{error}</p>
      )}

      <button onClick={onVolverLogin}>
        Volver al login
      </button>

    </div>
  );
}