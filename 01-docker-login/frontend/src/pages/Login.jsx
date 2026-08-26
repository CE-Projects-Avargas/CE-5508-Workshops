import { useState } from 'react';

// ============================================================
// TALLER DE HOY: completa este componente una vez que
// backend/routes/auth.js tenga /auth/login funcionando.
// Usa pages/NuevoProyecto.jsx como referencia del patrón
// (useState para el form, fetch en un try/catch, mensaje de error/éxito).
// ============================================================
export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [mensaje, setMensaje] = useState(null);

  function actualizarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function enviar(e) {
    e.preventDefault();

    // TODO 1: llama a fetch(`${API_URL}/auth/login`, { method: 'POST', ... })
    //   pista: mira crearProyecto() en src/api.js y sigue el mismo patrón,
    //   agrega una función login(email, password) ahí mismo

    // TODO 2: si la respuesta trae un token, guárdalo
    //   pista: localStorage.setItem('token', token)

    // TODO 3: muestra un mensaje de éxito o error con setMensaje(...)
    //   igual que en NuevoProyecto.jsx

    setMensaje({ tipo: 'error', texto: 'TODO: implementar login en el frontend' });
  }

  return (
    <>
      <h1>Iniciar sesión</h1>
      <form onSubmit={enviar}>
        <label>
          Email
          <input name="email" type="email" value={form.email} onChange={actualizarCampo} required />
        </label>
        <label>
          Contraseña
          <input name="password" type="password" value={form.password} onChange={actualizarCampo} required />
        </label>
        {mensaje && <div className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</div>}
        <button type="submit">Entrar</button>
      </form>
    </>
  );
}
