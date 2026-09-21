const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const JWKS_URL = process.env.AUTH_JWKS_URL || 'http://auth-service:4001/auth/jwks';
const JWT_ISS = process.env.JWT_ISS || 'auth-service';
const JWT_AUD = process.env.JWT_AUD || 'ce5508-taller2';
const JWKS_CACHE_TTL_MS = Number(process.env.JWKS_CACHE_TTL_MS || 5 * 60 * 1000);
const JWT_CLOCK_TOLERANCE_SECONDS = Number(process.env.JWT_CLOCK_TOLERANCE_SECONDS || 5);

const client = jwksClient({
  jwksUri: JWKS_URL,
  cache: true,
  cacheMaxAge: JWKS_CACHE_TTL_MS,
  cacheMaxEntries: Number(process.env.JWKS_CACHE_MAX_ENTRIES || 5),
  rateLimit: true,
  jwksRequestsPerMinute: Number(process.env.JWKS_REQUESTS_PER_MINUTE || 10)
});

function extraerBearer(header) {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function obtenerLlave(header, callback) {
  if (header.alg !== 'RS256') {
    return callback(new Error('Algoritmo invalido'));
  }

  if (!header.kid) {
    return callback(new Error('Token sin kid'));
  }

  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    return callback(null, key.getPublicKey());
  });
}

function verificarJwt(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      obtenerLlave,
      {
        algorithms: ['RS256'],
        issuer: JWT_ISS,
        audience: JWT_AUD,
        clockTolerance: JWT_CLOCK_TOLERANCE_SECONDS
      },
      (err, payload) => {
        if (err) return reject(err);
        return resolve(payload);
      }
    );
  });
}

async function verificarToken(req, res, next) {
  const token = extraerBearer(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const payload = await verificarJwt(token);

    req.usuario = {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      claims: payload
    };

    return next();
  } catch (err) {
    console.error('Error al verificar token:', err.message);
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }
}

module.exports = verificarToken;
