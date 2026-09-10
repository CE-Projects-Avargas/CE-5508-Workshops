// Verificación del token — ya resuelto.
//
// Esto es AUTENTICACIÓN: comprueba QUIÉN es el usuario.
// Lo que falta (y es el reto del taller) es la AUTORIZACIÓN:
// decidir QUÉ puede tocar ese usuario. Ver routes/bombas.js.
const jwt = require('jsonwebtoken');

module.exports = function verificarToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token requerido' });

  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalido o expirado' });
  }
};
