const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');


// Cliente que obtiene y almacena en caché las claves públicas de auth-service.
const client = jwksClient({
  jwksUri: process.env.JWKS_URL || 'http://auth-service:5000/jwks',
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000,
  rateLimit: true,
  jwksRequestsPerMinute: 10
});


// Obtiene la clave pública correspondiente al kid del JWT.
async function obtenerClavePublica(header, callback) {

  try {

    if (header.alg !== 'RS256' || !header.kid) {
      return callback(new Error('Encabezado JWT inválido'));
    }

    const clave = await client.getSigningKey(header.kid);

    callback(null, clave.getPublicKey());

  } catch (error) {

    callback(error);

  }
}


// Comprueba que cada petición tenga un access token válido.
function verificarToken(req, res, next) {

  const authorization = req.headers.authorization;

  if (!authorization) {

    return res.status(401).json({
      error: 'Token obligatorio'
    });

  }

  const partes = authorization.split(' ');

  if (
    partes.length !== 2 ||
    partes[0] !== 'Bearer' ||
    !partes[1]
  ) {

    return res.status(401).json({
      error: 'Formato de token inválido'
    });

  }

  const token = partes[1];

    // Verifica firma, espiración, emisor y audiencia del token usando la clave pública de auth-service.
  jwt.verify(
    token,
    obtenerClavePublica,
    {
      algorithms: ['RS256'],
      issuer: process.env.JWT_ISSUER || 'ce5508-auth',
      audience: process.env.JWT_AUDIENCE || 'ce5508-backend'
    },
    (error, decoded) => {

      if (error) {

        return res.status(401).json({
          error: 'Token inválido o expirado'
        });

      }
      //guarda el id y el email del usuario en la petición para que pueda ser usado en las rutas posteriores
      req.usuario = {
        id: decoded.sub,
        email: decoded.email
      };
      //Continúa hacia la ruta solicitada únicamente si el token es válido.
      next();

    }
  );

}

module.exports = verificarToken;