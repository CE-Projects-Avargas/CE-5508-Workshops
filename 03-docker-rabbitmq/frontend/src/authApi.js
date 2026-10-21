//única URL conocida por el frontend, todas las peticiones pasan por el gateway
const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:8080';

//Envía las credenciales del usuario al servicio de autenticación para iniciar sesión y obtener un token JWT
export async function iniciarSesion(email, password) {

  const response = await fetch(`${API_URL}/api/auth/login`, {

    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      email,
      password
    })

  });


  const body = await response.json();


  if (!response.ok) {

    throw new Error(
      body.error || 'Error al iniciar sesión'
    );

  }


  return body;

}
//Pasa los datos necesarios para registrar un nuevo usuario al servicio de autenticación y obtener un token JWT
export async function registrarUsuario(nombre, email, password) {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json'
    },

    body: JSON.stringify({
      nombre,
      email,
      password
    })
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.error || 'Error al registrar usuario'
    );
  }

  return body;
}


// Evita realizar varias renovaciones simultáneas
let renovacionEnCurso = null;


// Renueva las credenciales utilizando el refresh token
export async function renovarToken() {

  if (renovacionEnCurso) {
    return renovacionEnCurso;
  }

  renovacionEnCurso = realizarRenovacion();

  try {

    return await renovacionEnCurso;

  } finally {

    renovacionEnCurso = null;

  }

}


async function realizarRenovacion() {

  const refreshToken = localStorage.getItem(
    'refreshToken'
  );

  if (!refreshToken) {
    throw new Error('No existe una sesión para renovar');
  }

  const response = await fetch(
    `${API_URL}/api/auth/refresh`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json'
      },

      body: JSON.stringify({
        refreshToken
      })
    }
  );

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.error || 'No se pudo renovar la sesión'
    );
  }

  // Evita restaurar una sesión que se cerró
  // mientras se procesaba la renovación.
  if (
    localStorage.getItem('refreshToken') !== refreshToken
  ) {
    throw new Error('La sesión fue cerrada');
  }

  // Reemplaza las credenciales anteriores
  localStorage.setItem(
    'accessToken',
    body.accessToken
  );

  localStorage.setItem(
    'refreshToken',
    body.refreshToken
  );

  localStorage.setItem(
    'expiracion',
    (
      Date.now() +
      body.expiresIn * 1000
    ).toString()
  );

  return body.accessToken;

}
