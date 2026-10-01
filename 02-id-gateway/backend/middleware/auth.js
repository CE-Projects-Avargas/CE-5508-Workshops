// Defensa en profundidad: backend verifica el token POR SU CUENTA,
// aunque la peticion no haya pasado por el gateway.
//
// - Sin secreto compartido: se verifica con la clave PUBLICA de auth-service,
//   que se obtiene de su JWKS (GET /auth/jwks).
// - createRemoteJWKSet (libreria jose) descarga el JWKS la primera vez y lo
//   CACHEA en memoria. Solo vuelve a pedirlo si llega un kid desconocido.
// - jwtVerify comprueba firma + exp + iss + aud. No se confia en ninguna
//   cabecera tipo X-User-Id.
const { createRemoteJWKSet, jwtVerify, errors } = require('jose');

const JWKS_URL = process.env.JWKS_URL || 'http://auth-service:5001/auth/jwks';
const JWT_ISSUER = process.env.JWT_ISSUER || 'ce5508-auth-service';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'ce5508-backend';

const JWKS = createRemoteJWKSet(new URL(JWKS_URL), {
  cacheMaxAge: 10 * 60 * 1000,  // se considera fresco 10 min
  cooldownDuration: 30 * 1000   // no volver a pedirlo mas de una vez cada 30 s
});

// Valido -> deja el usuario en req.usuario y sigue.
// Ausente, firma invalida, vencido, iss/aud incorrectos -> 401.
async function verificarJWT(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'token ausente' });
  }

  try {
    const { payload } = await jwtVerify(header.slice(7), JWKS, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['RS256'],        // nunca aceptar 'none' ni HS256
      requiredClaims: ['sub', 'exp']
    });
    req.usuario = { ...payload, id: Number(payload.sub) };
    return next();
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      return res.status(401).json({ error: 'token expirado' });
    }
    if (err instanceof errors.JWKSTimeout || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      // No se pudo descargar el JWKS (auth caido y todavia sin cache)
      return res.status(503).json({ error: 'no se pudo obtener el JWKS de auth-service' });
    }
    return res.status(401).json({ error: 'token invalido' });
  }
}

module.exports = verificarJWT;