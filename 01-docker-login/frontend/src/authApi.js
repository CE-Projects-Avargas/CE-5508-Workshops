const AUTH_URL =
  import.meta.env.VITE_AUTH_URL || 'http://localhost:5000';

//Envía las credenciales del usuario al servicio de autenticación para iniciar sesión y obtener un token JWT
export async function iniciarSesion(email, password) {

  const response = await fetch(`${AUTH_URL}/login`, {

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
  const response = await fetch(`${AUTH_URL}/register`, {
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