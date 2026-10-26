// Middleware de autenticación para device-service.
// Valida access tokens mediante las claves públicas del endpoint JWKS.

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWKS_URL =
  process.env.JWKS_URL || 'http://auth-service:4001/jwks';

const ISSUER = 'cafetico-auth';
const AUDIENCE = 'cafetico-api';
const TOKEN_TYPE = 'access';

const ESPERA_RECARGA_MS = 30 * 1000;

// Cache de claves públicas: kid -> clave pública PEM.
const jwksCache = new Map();

let ultimaCarga = 0;
let cargaEnCurso = null;

class JwksNoDisponible extends Error {}

// Convierte una clave pública RSA en formato JWK a PEM.
function jwkToPem(jwk) {
  return crypto
    .createPublicKey({
      key: {
        kty: jwk.kty,
        n: jwk.n,
        e: jwk.e
      },
      format: 'jwk'
    })
    .export({
      type: 'spki',
      format: 'pem'
    });
}

// Obtiene las claves públicas del servicio de autenticación.
async function cargarJWKS() {
  let response;

  try {
    response = await fetch(JWKS_URL);
  } catch (err) {
    throw new JwksNoDisponible(
      `No se pudo consultar el JWKS: ${err.message}`
    );
  }

  if (!response.ok) {
    throw new JwksNoDisponible(
      `El JWKS respondió HTTP ${response.status}`
    );
  }

  let jwks;

  try {
    jwks = await response.json();
  } catch {
    throw new JwksNoDisponible(
      'El endpoint JWKS devolvió JSON inválido'
    );
  }

  if (!Array.isArray(jwks.keys)) {
    throw new JwksNoDisponible(
      'La respuesta JWKS no contiene un arreglo de claves'
    );
  }

  const nuevasClaves = new Map();

  try {
    for (const jwk of jwks.keys) {
      if (
        jwk.kty === 'RSA' &&
        jwk.kid &&
        (!jwk.alg || jwk.alg === 'RS256') &&
        (!jwk.use || jwk.use === 'sig')
      ) {
        nuevasClaves.set(jwk.kid, jwkToPem(jwk));
      }
    }
  } catch (err) {
    throw new JwksNoDisponible(
      `No se pudieron procesar las claves JWKS: ${err.message}`
    );
  }

  if (nuevasClaves.size === 0) {
    throw new JwksNoDisponible(
      'El endpoint JWKS no contiene claves RSA válidas'
    );
  }

  // Actualizamos la cache únicamente después de procesar las claves.
  jwksCache.clear();

  for (const [kid, publicKey] of nuevasClaves) {
    jwksCache.set(kid, publicKey);
  }

  ultimaCarga = Date.now();

  console.log(
    `JWKS actualizado. Claves en cache: ${jwksCache.size}`
  );
}

// Evita hacer varias solicitudes JWKS simultáneamente.
function recargarJWKS() {
  if (!cargaEnCurso) {
    cargaEnCurso = cargarJWKS().finally(() => {
      cargaEnCurso = null;
    });
  }

  return cargaEnCurso;
}

// Busca la clave correspondiente al identificador kid.
async function getPublicKey(kid) {
  const cacheVencida =
    Date.now() - ultimaCarga > ESPERA_RECARGA_MS;

  if (jwksCache.has(kid) && !cacheVencida) {
    return jwksCache.get(kid);
  }

  if (
    jwksCache.size === 0 ||
    cacheVencida ||
    !jwksCache.has(kid)
  ) {
    await recargarJWKS();
  }

  return jwksCache.get(kid) || null;
}

// Middleware principal de autenticación.
module.exports = async function verificarToken(req, res, next) {
  const [scheme, token] = (
    req.headers.authorization || ''
  ).split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      error: 'Token requerido'
    });
  }

  const decoded = jwt.decode(token, {
    complete: true
  });

  if (
    !decoded ||
    !decoded.header ||
    decoded.header.alg !== 'RS256' ||
    !decoded.header.kid
  ) {
    return res.status(401).json({
      error: 'Token invalido'
    });
  }

  let publicKey;

  try {
    publicKey = await getPublicKey(decoded.header.kid);
  } catch (err) {
    console.error(
      'Error al consultar JWKS:',
      err.message
    );

    return res.status(503).json({
      error: 'No se pudo validar el token en este momento'
    });
  }

  if (!publicKey) {
    return res.status(401).json({
      error: 'Token firmado con una clave desconocida'
    });
  }

  try {
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

    if (!payload.sub) {
      return res.status(401).json({
        error: 'El token no contiene un usuario válido'
      });
    }

    req.usuario = {
      id: payload.sub,
      email: payload.email
    };

    return next();
  } catch (err) {
    const error =
      err.name === 'TokenExpiredError'
        ? 'Token expirado'
        : 'Token invalido';

    return res.status(401).json({
      error
    });
  }
};
