const jwt = require('jsonwebtoken');

// Mismo secreto y algoritmo (HS256) que usa el auth-service para firmar.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-ce5508-cambialo';

// Verifica el header 'Authorization: Bearer <token>'.
// Si el token es válido deja el payload en req.usuario; si no, responde 401.
function verificarJWT(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'token ausente' });
  }

  try {
    req.usuario = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'token invalido o expirado' });
  }
}

module.exports = verificarJWT;
