import { useEffect, useState } from 'react';
import Login from './pages/Login.jsx';
import NuevoProyecto from './pages/NuevoProyecto.jsx';

const SESION_KEY = 'sesion';

function decodificarPayloadJwt(token) {
  const [, payload] = token.split('.');
  if (!payload) return null;

  const base64 = payload
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(payload.length / 4) * 4, '=');
  const json = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('')
  );

  return JSON.parse(json);
}

function construirSesion({ accessToken, refreshToken, expiresIn }) {
  const payload = decodificarPayloadJwt(accessToken);

  return {
    accessToken,
    refreshToken,
    expiresIn,
    expiresAt: payload?.exp ? payload.exp * 1000 : Date.now() + expiresIn * 1000,
    usuario: {
      id: payload?.sub,
      nombre: payload?.nombre,
      email: payload?.email
    }
  };
}

export default function App() {
  const [sesion, setSesion] = useState(null);

  // Al cargar la app, revisa si ya habia una sesion guardada
  useEffect(() => {
    const guardado = localStorage.getItem(SESION_KEY);
    if (!guardado) return;

    try {
      const sesionGuardada = JSON.parse(guardado);
      if (sesionGuardada?.accessToken && sesionGuardada?.refreshToken) {
        setSesion(sesionGuardada);
      }
    } catch {
      localStorage.removeItem(SESION_KEY);
    }
  }, []);

  // Si api.js no pudo renovar los tokens, se vuelve al login
  useEffect(() => {
    window.addEventListener('sesion-expirada', handleLogout);
    return () => window.removeEventListener('sesion-expirada', handleLogout);
  }, []);

  function handleLogin(tokens) {
    const nuevaSesion = construirSesion(tokens);
    localStorage.setItem(SESION_KEY, JSON.stringify(nuevaSesion));
    localStorage.removeItem('usuario');
    setSesion(nuevaSesion);
  }

  function handleLogout() {
    localStorage.removeItem(SESION_KEY);
    localStorage.removeItem('usuario');
    setSesion(null);
  }

  // Sin sesion valida, no se pasa a la pantalla de proyectos
  if (!sesion) {
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
          Sesion: <strong>{sesion.usuario.nombre || sesion.usuario.email}</strong>
        </span>
        <button onClick={handleLogout}>Cerrar sesion</button>
      </div>
      <NuevoProyecto />
    </main>
  );
}