const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Cliente que obtiene y mantiene en caché las claves públicas publicadas por auth-service.
const client = jwksClient({
  jwksUri: process.env.JWKS_URL || 'http://auth-service:5000/jwks',
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000,
  rateLimit: true,
  jwksRequestsPerMinute: 10
});

// Obtiene la clave pública correspondiente al kid incluido en el encabezado del JWT.
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

      req.usuario = {
        id: decoded.sub,
        email: decoded.email
      };

      next();
    }
  );
}

module.exports = verificarToken;