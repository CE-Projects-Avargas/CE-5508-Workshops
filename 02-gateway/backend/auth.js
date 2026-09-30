// Middleware de autenticacion: valida el access token por cuenta propia, sin preguntarle a auth-service
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const JWKS_URL = process.env.JWKS_URL || 'http://auth-service:4001/jwks';
const ISSUER = 'cafetico-auth';
const AUDIENCE = 'cafetico-api';
const TOKEN_TYPE = 'access';

// Si llega un kid desconocido no se vuelve a pedir el JWKS antes de este tiempo
const ESPERA_RECARGA_MS = 30 * 1000;

// Cache en memoria: kid -> clave publica PEM
const jwksCache = new Map();
let ultimaCarga = 0;
let cargaEnCurso = null;

class JwksNoDisponible extends Error {}

function jwkToPem(jwk) {
  return crypto
    .createPublicKey({ key: { kty: jwk.kty, n: jwk.n, e: jwk.e }, format: 'jwk' })
    .export({ type: 'spki', format: 'pem' });
}

async function cargarJWKS() {
  let response;
  try {
    response = await fetch(JWKS_URL);
  } catch (err) {
    throw new JwksNoDisponible(`No se pudo consultar el JWKS: ${err.message}`);
  }
  if (!response.ok) throw new JwksNoDisponible(`JWKS respondio HTTP ${response.status}`);

  const jwks = await response.json();
  if (!Array.isArray(jwks.keys)) throw new JwksNoDisponible('Respuesta JWKS invalida');

  for (const jwk of jwks.keys) {
    if (jwk.kid && jwk.kty === 'RSA') jwksCache.set(jwk.kid, jwkToPem(jwk));
  }
  ultimaCarga = Date.now();
  console.log(`JWKS actualizado. Claves en cache: ${jwksCache.size}`);
}

// Una sola recarga a la vez aunque lleguen muchas peticiones juntas
function recargarJWKS() {
  if (!cargaEnCurso) cargaEnCurso = cargarJWKS().finally(() => { cargaEnCurso = null; });
  return cargaEnCurso;
}

async function getPublicKey(kid) {
  if (jwksCache.has(kid)) return jwksCache.get(kid);

  // kid nuevo (p. ej. auth roto su llave): se recarga, pero no mas de una vez cada ESPERA_RECARGA_MS
  if (jwksCache.size === 0 || Date.now() - ultimaCarga > ESPERA_RECARGA_MS) {
    await recargarJWKS();
  }
  return jwksCache.get(kid) || null;
}

module.exports = async function verificarToken(req, res, next) {
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || decoded.header.alg !== 'RS256' || !decoded.header.kid) {
    return res.status(401).json({ error: 'Token invalido' });
  }

  let publicKey;
  try {
    publicKey = await getPublicKey(decoded.header.kid);
  } catch (err) {
    console.error(err.message);
    return res.status(503).json({ error: 'No se pudo validar el token en este momento' });
  }
  if (!publicKey) return res.status(401).json({ error: 'Token firmado con una clave desconocida' });

  try {
    // jwt.verify comprueba firma y exp; issuer y audience se piden explicitamente
    const payload = jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: ISSUER,
      audience: AUDIENCE
    });
    if (payload.type !== TOKEN_TYPE) {
      return res.status(401).json({ error: 'El token no es un access token' });
    }
    req.usuario = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    const error = err.name === 'TokenExpiredError' ? 'Token expirado' : 'Token invalido';
    return res.status(401).json({ error });
  }
};
