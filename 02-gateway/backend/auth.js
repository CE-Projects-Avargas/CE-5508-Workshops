const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWKS_URL = 'http://auth-service:4001/jwks';

const ISSUER = 'cafetico-auth';
const AUDIENCE = 'cafetico-api';
const TOKEN_TYPE = 'access';

function jwkToPem(jwk) {
  const keyObject = crypto.createPublicKey({
    key: {
      kty: 'RSA',
      n: jwk.n,
      e: jwk.e
    },
    format: 'jwk'
  });

  return keyObject.export({
    type: 'spki',
    format: 'pem'
  });
}

async function getPublicKey(kid) {
  const response = await fetch(JWKS_URL);

  if (!response.ok) {
    throw new Error(`JWKS respondió HTTP ${response.status}`);
  }

  const jwks = await response.json();

  const jwk = jwks.keys.find(key => key.kid === kid);

  if (!jwk) {
    throw new Error(`No se encontró una clave con kid=${kid}`);
  }

  return jwkToPem(jwk);
}

module.exports = async function verificarToken(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      error: 'Token requerido'
    });
  }

  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: 'Formato de Authorization inválido'
    });
  }

  try {
    const decoded = jwt.decode(token, { complete: true });

    if (!decoded || !decoded.header) {
      return res.status(401).json({
        error: 'Token inválido'
      });
    }

    const { kid, alg } = decoded.header;

    if (alg !== 'RS256') {
      return res.status(401).json({
        error: 'Algoritmo de token no permitido'
      });
    }

    if (!kid) {
      return res.status(401).json({
        error: 'Token sin kid'
      });
    }

    const publicKey = await getPublicKey(kid);

    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: ISSUER,
      audience: AUDIENCE
    });

    if (payload.type !== TOKEN_TYPE) {
      return res.status(401).json({
        error: 'El token no es un access token'
      });
    }

    req.usuario = {
      id: payload.sub,
      email: payload.email
    };

    next();

  } catch (err) {
    console.error('Error verificando token:', err.message);

    return res.status(401).json({
      error: 'Token inválido o expirado'
    });
  }
};