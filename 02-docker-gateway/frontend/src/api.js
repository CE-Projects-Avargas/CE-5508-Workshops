import { renovarToken } from './authApi.js';

const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8080';


//Realiza una petición protegida enviando el access token
async function peticionAutenticada(ruta, opciones = {}) {

  let accessToken = localStorage.getItem(
    'accessToken'
  );

  const expiracion = Number(
    localStorage.getItem('expiracion')
  );

  try {

    // Renueva el token si no existe o ya expiró
    if (
      !accessToken ||
      (expiracion && Date.now() >= expiracion)
    ) {

      accessToken = await renovarToken();

    }

    const realizarPeticion = (token) => {

      return fetch(`${API_URL}${ruta}`, {

        ...opciones,

        headers: {
          ...opciones.headers,
          Authorization: `Bearer ${token}`
        }

      });

    };


    // Primera petición al backend
    let respuesta = await realizarPeticion(
      accessToken
    );


    // Si el backend devuelve 401, intenta renovar
    if (respuesta.status === 401) {

      accessToken = await renovarToken();

      // Reintenta la petición una sola vez
      respuesta = await realizarPeticion(
        accessToken
      );

    }


    // Si la renovación no resolvió el problema
    if (respuesta.status === 401) {

      throw new Error(
        'No se pudo autenticar la petición'
      );

    }


    const body = await respuesta.json();


    if (!respuesta.ok) {

      throw new Error(
        body.error || 'Error al realizar la petición'
      );

    }


    return body;

  } catch (error) {

    // Solo cierra la sesión si ya no es posible
    // obtener o utilizar un token válido.
    if (
      error.message === 'No existe una sesión para renovar' ||
      error.message === 'Refresh token inválido' ||
      error.message === 'Refresh token inválido o expirado' ||
      error.message === 'No se pudo autenticar la petición'
    ) {

      window.dispatchEvent(
        new Event('sesion-expirada')
      );

    }

    throw error;

  }

}


// Consulta los proyectos del backend
export async function listarProyectos() {

  return peticionAutenticada(
    '/api/proyectos'
  );

}


// Crea un proyecto nuevo
export async function crearProyecto(datos) {

  return peticionAutenticada(
    '/api/proyectos',
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify(datos)
    }
  );

}