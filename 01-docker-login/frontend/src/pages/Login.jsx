import { useState } from 'react';

// El reto de hoy es el servicio de auth. Conectar esta pantalla a él
// es libre — decide cómo llamarlo, qué guardar y cómo mostrar el resultado.
export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });

  function actualizarCampo(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function enviar(e) {
    e.preventDefault();
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
        <button type="submit">Entrar</button>
      </form>
    </>
  );
}
