const crypto = require('crypto');

const JWKS_URL = process.env.AUTH_JWKS_URL || 'http://auth-service:4001/auth/jwks';
const JWT_ISS = process.env.JWT_ISS || 'auth-service';
const JWT_AUD = process.env.JWT_AUD || 'ce5508-taller2';
const JWKS_CACHE_TTL_MS = Number(process.env.JWKS_CACHE_TTL_MS || 5 * 60 * 1000);
const CLOCK_TOLERANCE_SECONDS = Number(process.env.JWT_CLOCK_TOLERANCE_SECONDS || 5);

let cache = {
  keys: new Map(),
  expiresAt: 0,
  loading: null
};

function decodificarBase64Url(valor) {
  return Buffer.from(valor, 'base64url');
}

function decodificarJson(segmento, nombre) {
  try {
    return JSON.parse(decodificarBase64Url(segmento).toString('utf8'));
  } catch {
    throw new Error(`${nombre} invalido`);
  }
}

function extraerBearer(header) {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

async function cargarJWKS(forzar = false) {
  const ahora = Date.now();

  if (!forzar && cache.keys.size > 0 && cache.expiresAt > ahora) {
    return cache.keys;
  }

  if (cache.loading) {
    return cache.loading;
  }

  cache.loading = (async () => {
    const respuesta = await fetch(JWKS_URL);
    if (!respuesta.ok) {
      throw new Error(`JWKS respondio ${respuesta.status}`);
    }

    const jwks = await respuesta.json();
    if (!Array.isArray(jwks.keys)) {
      throw new Error('JWKS sin arreglo keys');
    }

    const keys = new Map();
    for (const jwk of jwks.keys) {
      if (jwk.kty !== 'RSA' || !jwk.kid) continue;
      const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
      keys.set(jwk.kid, publicKey);
    }

    if (keys.size === 0) {
      throw new Error('JWKS sin llaves RSA validas');
    }

    cache = {
      keys,
      expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
      loading: null
    };

    return keys;
  })();

  try {
    return await cache.loading;
  } finally {
    cache.loading = null;
  }
}

async function obtenerLlave(kid) {
  if (!kid) {
    throw new Error('Token sin kid');
  }

  let keys = await cargarJWKS(false);
  let publicKey = keys.get(kid);

  if (!publicKey) {
    keys = await cargarJWKS(true);
    publicKey = keys.get(kid);
  }

  if (!publicKey) {
    throw new Error('kid desconocido');
  }

  return publicKey;
}

function validarClaims(payload) {
  const ahora = Math.floor(Date.now() / 1000);

  if (typeof payload.exp !== 'number' || payload.exp + CLOCK_TOLERANCE_SECONDS < ahora) {
    throw new Error('Token expirado');
  }

  if (payload.nbf && payload.nbf - CLOCK_TOLERANCE_SECONDS > ahora) {
    throw new Error('Token aun no valido');
  }

  if (payload.iss !== JWT_ISS) {
    throw new Error('Issuer invalido');
  }

  const audiencias = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiencias.includes(JWT_AUD)) {
    throw new Error('Audience invalido');
  }

  if (!payload.sub) {
    throw new Error('Token sin subject');
  }
}

async function verificarToken(req, res, next) {
  const token = extraerBearer(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  const partes = token.split('.');
  if (partes.length !== 3) {
    return res.status(401).json({ error: 'Token invalido' });
  }

  try {
    const [headerB64, payloadB64, firmaB64] = partes;
    const header = decodificarJson(headerB64, 'Header');
    const payload = decodificarJson(payloadB64, 'Payload');

    if (header.alg !== 'RS256') {
      throw new Error('Algoritmo invalido');
    }

    const publicKey = await obtenerLlave(header.kid);
    const firmaValida = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      publicKey,
      decodificarBase64Url(firmaB64)
    );

    if (!firmaValida) {
      throw new Error('Firma invalida');
    }

    validarClaims(payload);

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
